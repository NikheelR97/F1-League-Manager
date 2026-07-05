import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { cacheTag } from "@/lib/cache/tags";
import { recalculateStandings } from "@/lib/results/publish-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

// Mirrors the `adjustment_kind` enum, `points_delta` bounds (-200..200), and
// `championship_adjustments_one_target` check in
// supabase/migrations/20260507161000_s1_core_schema.sql.
const bodySchema = z
  .object({
    adjustment_kind: z.enum(["bonus", "penalty", "correction"]),
    driver_id: z.string().uuid().nullable().optional(),
    points_delta: z.number().int().min(-200).max(200),
    reason: z.string().trim().min(1).max(240),
    season_id: z.string().uuid(),
    team_id: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Boolean(data.driver_id) !== Boolean(data.team_id), {
    message: "Exactly one of driver_id or team_id must be set",
    path: ["driver_id"],
  });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid league id" }, { status: 422 });
    }
    const { id: leagueId } = parsedParams.data;

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch (e) {
      if (e instanceof z.ZodError) {
        return Response.json({ error: e.flatten() }, { status: 422 });
      }
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("constructor_championship_enabled, penalty_threshold")
      .eq("id", leagueId)
      .single();

    if (leagueError || !league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    // Cheap existence checks. `seasons` isn't league-scoped in the schema, so
    // league_driver_entries (league_id + season_id) is the record that proves
    // a season is actually in use by this league.
    if (body.driver_id) {
      const { data: entry, error: entryError } = await db
        .from("league_driver_entries")
        .select("id")
        .eq("league_id", leagueId)
        .eq("season_id", body.season_id)
        .eq("driver_id", body.driver_id)
        .limit(1)
        .maybeSingle();

      if (entryError) {
        return Response.json({ error: "Failed to verify driver" }, { status: 500 });
      }
      if (!entry) {
        return Response.json(
          { error: "Driver not found in this league/season" },
          { status: 422 },
        );
      }
    } else if (body.team_id) {
      const [{ data: team, error: teamError }, { data: seasonEntry, error: seasonError }] =
        await Promise.all([
          db.from("teams").select("id").eq("id", body.team_id).eq("league_id", leagueId).single(),
          db
            .from("league_driver_entries")
            .select("id")
            .eq("league_id", leagueId)
            .eq("season_id", body.season_id)
            .limit(1)
            .maybeSingle(),
        ]);

      if (teamError && teamError.code !== "PGRST116") {
        return Response.json({ error: "Failed to verify team" }, { status: 500 });
      }
      if (!team) {
        return Response.json({ error: "Team not found in this league" }, { status: 422 });
      }
      if (seasonError) {
        return Response.json({ error: "Failed to verify season" }, { status: 500 });
      }
      if (!seasonEntry) {
        return Response.json({ error: "Season not found for this league" }, { status: 422 });
      }
    } else {
      // Unreachable — the XOR refine above already rejects this shape.
      return Response.json({ error: "Invalid target" }, { status: 422 });
    }

    const { data: created, error: insertError } = await db
      .from("championship_adjustments")
      .insert({
        adjustment_kind: body.adjustment_kind,
        applied_by: auth.user.id,
        driver_id: body.driver_id ?? null,
        league_id: leagueId,
        points_delta: body.points_delta,
        reason: body.reason,
        season_id: body.season_id,
        team_id: body.team_id ?? null,
      })
      .select("id, adjustment_kind, points_delta, reason")
      .single();

    if (insertError || !created) {
      return Response.json({ error: "Failed to create adjustment" }, { status: 500 });
    }

    const recalcResult = await recalculateStandings(
      db,
      leagueId,
      body.season_id,
      league.constructor_championship_enabled,
      league.penalty_threshold,
    );

    if (!recalcResult.ok) {
      return Response.json({ error: recalcResult.error }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "adjustment.created",
      actorId: auth.user.id,
      entityId: created.id,
      entityType: "championship_adjustment",
      metadata: {
        adjustment_kind: body.adjustment_kind,
        driver_id: body.driver_id ?? null,
        league_id: leagueId,
        points_delta: body.points_delta,
        season_id: body.season_id,
        team_id: body.team_id ?? null,
      },
    });

    revalidateTag(cacheTag.standings(leagueId), "default");

    // Sanitized response — applied_by/league_id/season_id never leave this route.
    return Response.json(
      {
        id: created.id,
        adjustment_kind: created.adjustment_kind,
        points_delta: created.points_delta,
        reason: created.reason,
      },
      { status: 201 },
    );
  });
}
