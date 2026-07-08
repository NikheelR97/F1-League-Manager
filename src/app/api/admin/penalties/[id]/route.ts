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

// Matches the `penalty_status` enum in supabase/migrations/20260507161000_s1_core_schema.sql
const bodySchema = z.object({
  status: z.enum(["open", "served", "appealed", "rescinded"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid penalty id" }, { status: 422 });
    }
    const { id: penaltyId } = parsedParams.data;

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

    const { data: penalty, error: fetchError } = await db
      .from("penalties")
      .select("id, league_id, season_id, status")
      .eq("id", penaltyId)
      .single();

    if (fetchError || !penalty) {
      return Response.json({ error: "Penalty not found" }, { status: 404 });
    }

    const previousStatus = penalty.status;

    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("constructor_championship_enabled, penalty_threshold")
      .eq("id", penalty.league_id)
      .single();

    if (leagueError || !league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    const { data: updated, error: updateError } = await db
      .from("penalties")
      .update({ status: body.status })
      .eq("id", penaltyId)
      .select("id, status")
      .single();

    if (updateError || !updated) {
      return Response.json({ error: "Failed to update penalty" }, { status: 500 });
    }

    // Same recalculation publish uses — status changes affect penalty totals
    // (rescinded is excluded) and therefore ban thresholds/standings (B4).
    const recalcResult = await recalculateStandings(
      db,
      penalty.league_id,
      penalty.season_id,
      league.constructor_championship_enabled,
      league.penalty_threshold,
    );

    if (!recalcResult.ok) {
      return Response.json({ error: recalcResult.error }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "penalty.status_changed",
      actorId: auth.user.id,
      entityId: penaltyId,
      entityType: "penalty",
      metadata: {
        from: previousStatus,
        league_id: penalty.league_id,
        to: body.status,
      },
    });

    revalidateTag(cacheTag.standings(penalty.league_id), "default");
    revalidateTag(cacheTag.penalties(penalty.league_id), "default");

    // Sanitized response — steward_notes/appeal_notes never leave this admin route.
    return Response.json({ id: updated.id, status: updated.status });
  });
}
