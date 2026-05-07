import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_DRIVERS_LIST, MAX_PRIMARY_DRIVERS_PER_TEAM } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const addDriverSchema = z.object({
  carry_over_ban_count: z.number().int().min(0).default(0),
  carry_over_penalty_points: z.number().int().min(0).default(0),
  driver_id: z.string().uuid(),
  is_reserve: z.boolean().default(false),
  joined_on: z.string().date(),
  team_id: z.string().uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async () => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("league_driver_entries")
      .select(`
        id,
        is_reserve,
        joined_on,
        left_on,
        carry_over_penalty_points,
        carry_over_ban_count,
        drivers(id, display_name, racing_number, country),
        driver_team_stints(team_id, starts_on, ends_on, teams(name, color_hex))
      `)
      .eq("league_id", leagueId)
      .is("left_on", null)
      .order("joined_on")
      .limit(MAX_DRIVERS_LIST);

    if (error) return Response.json({ error: "Failed to load drivers" }, { status: 500 });
    return Response.json({ drivers: data });
  }, { skipCsrf: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const body = await req.json();
    const parsed = addDriverSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { carry_over_ban_count, carry_over_penalty_points, driver_id, is_reserve, joined_on, team_id } = parsed.data;
    const db = createSupabaseServiceRoleClient();

    // Verify team belongs to this league
    const { data: team } = await db
      .from("teams")
      .select("id, name, league_id")
      .eq("id", team_id)
      .eq("league_id", leagueId)
      .single();

    if (!team) {
      return Response.json({ error: "Team not found in this league" }, { status: 422 });
    }

    // Enforce primary driver limit (only for non-reserve assignments)
    if (!is_reserve) {
      const { count } = await db
        .from("league_driver_entries")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId)
        .is("left_on", null)
        .eq("is_reserve", false)
        .in(
          "id",
          (
            await db
              .from("driver_team_stints")
              .select("league_driver_entry_id")
              .eq("team_id", team_id)
              .is("ends_on", null)
          ).data?.map((s) => s.league_driver_entry_id) ?? [],
        );

      if ((count ?? 0) >= MAX_PRIMARY_DRIVERS_PER_TEAM) {
        return Response.json(
          { error: `This team already has ${MAX_PRIMARY_DRIVERS_PER_TEAM} primary drivers` },
          { status: 422 },
        );
      }
    }

    // Fetch the current season for this league
    const { data: league } = await db
      .from("leagues")
      .select("season_id")
      .eq("id", leagueId)
      .single();

    if (!league?.season_id) {
      return Response.json({ error: "League has no season" }, { status: 422 });
    }

    // Check driver isn't already active in this league
    const { data: existing } = await db
      .from("league_driver_entries")
      .select("id")
      .eq("league_id", leagueId)
      .eq("driver_id", driver_id)
      .is("left_on", null)
      .single();

    if (existing) {
      return Response.json({ error: "Driver is already active in this league" }, { status: 409 });
    }

    // Create entry + stint atomically via RPC would be ideal, but we use sequential inserts
    // with service-role (no RLS) — partial failure leaves orphaned entry, acceptable for S3
    const { data: entry, error: entryError } = await db
      .from("league_driver_entries")
      .insert({
        carry_over_ban_count,
        carry_over_penalty_points,
        driver_id,
        is_reserve,
        joined_on,
        league_id: leagueId,
        season_id: league.season_id,
      })
      .select("id")
      .single();

    if (entryError) {
      if (entryError.code === "23505") {
        return Response.json({ error: "Driver already in this league/season" }, { status: 409 });
      }
      return Response.json({ error: "Failed to add driver" }, { status: 500 });
    }

    const { error: stintError } = await db
      .from("driver_team_stints")
      .insert({
        league_driver_entry_id: entry.id,
        starts_on: joined_on,
        team_id,
      });

    if (stintError) {
      return Response.json({ error: "Driver added but team assignment failed" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "league_driver.added",
      actorId: auth.user.id,
      entityId: entry.id,
      entityType: "league_driver_entry",
      metadata: { driver_id, is_reserve, league_id: leagueId, team_id },
    });

    return Response.json({ entry_id: entry.id }, { status: 201 });
  });
}
