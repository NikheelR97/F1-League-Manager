import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_DRIVERS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  source_season_id: z.string().uuid(),
  target_season_id: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const rawParams = await params;
    const parsedParams = paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid league id" }, { status: 422 });
    }
    const { id: leagueId } = parsedParams.data;

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    if (body.source_season_id === body.target_season_id) {
      return Response.json(
        { error: "Source and target seasons must differ" },
        { status: 422 },
      );
    }

    const db = createSupabaseServiceRoleClient();

    // Verify league and target season exist in parallel.
    const [
      { data: league, error: leagueErr },
      { data: targetSeason, error: targetErr },
    ] = await Promise.all([
      db.from("leagues").select("id").eq("id", leagueId).single(),
      db.from("seasons").select("id").eq("id", body.target_season_id).single(),
    ]);

    if (leagueErr && leagueErr.code !== "PGRST116") {
      return Response.json({ error: "Failed to load league" }, { status: 500 });
    }
    if (!league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    if (targetErr && targetErr.code !== "PGRST116") {
      return Response.json({ error: "Failed to load target season" }, { status: 500 });
    }
    if (!targetSeason) {
      return Response.json({ error: "Target season not found" }, { status: 404 });
    }

    // Fetch all driver entries for the source season in this league.
    const { data: sourceEntries, error: entriesErr } = await db
      .from("league_driver_entries")
      .select("driver_id")
      .eq("league_id", leagueId)
      .eq("season_id", body.source_season_id)
      .limit(MAX_DRIVERS_LIST + 1);

    if (entriesErr) {
      return Response.json({ error: "Failed to load source entries" }, { status: 500 });
    }
    if ((sourceEntries?.length ?? 0) > MAX_DRIVERS_LIST) {
      return Response.json(
        { error: "Too many source drivers to carry over at once" },
        { status: 422 },
      );
    }
    if (!sourceEntries?.length) {
      return Response.json(
        { error: "No drivers found in the source season for this league" },
        { status: 422 },
      );
    }

    const driverIds = sourceEntries.map((e) => e.driver_id);

    // Fetch penalty totals for those drivers in the source season.
    const { data: penaltyTotals, error: penaltyErr } = await db
      .from("driver_penalty_totals")
      .select("driver_id, penalty_points, ban_threshold_reached")
      .eq("league_id", leagueId)
      .eq("season_id", body.source_season_id)
      .in("driver_id", driverIds)
      .limit(MAX_DRIVERS_LIST);

    if (penaltyErr) {
      return Response.json({ error: "Failed to load penalty totals" }, { status: 500 });
    }

    const penaltyMap = new Map(
      (penaltyTotals ?? []).map((p) => [p.driver_id, p]),
    );

    // Build new entries for the target season.
    const newEntries = driverIds.map((driverId) => {
      const totals = penaltyMap.get(driverId);
      return {
        driver_id: driverId,
        league_id: leagueId,
        season_id: body.target_season_id,
        carry_over_penalty_points: totals?.penalty_points ?? 0,
        carry_over_ban_count: totals?.ban_threshold_reached ? 1 : 0,
      };
    });

    // Upsert — allow re-running without duplicating entries.
    const { error: upsertErr } = await db
      .from("league_driver_entries")
      .upsert(newEntries, { onConflict: "league_id,season_id,driver_id" });

    if (upsertErr) {
      return Response.json({ error: "Failed to create carry-over entries" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "season.carry_over",
      actorId: auth.user.id,
      entityId: leagueId,
      entityType: "league",
      metadata: {
        source_season_id: body.source_season_id,
        target_season_id: body.target_season_id,
        driver_count: driverIds.length,
      },
    });

    return Response.json({ carried_over: driverIds.length }, { status: 201 });
  });
}
