import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { cacheTag } from "@/lib/cache/tags";
import { getCurrentSeason } from "@/lib/leagues/get-current-season";
import { recalculateStandings } from "@/lib/results/publish-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Manual GUI trigger for standings recalculation — mirrors the automatic
// recalc that already runs on publish / points-system edit / carry-over,
// for cases where an admin wants to force a rebuild without one of those
// actions (e.g. after a data fix made directly in the DB).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("id, constructor_championship_enabled, penalty_threshold")
      .eq("id", leagueId)
      .maybeSingle();

    if (leagueError || !league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    const currentSeason = await getCurrentSeason(db, leagueId);
    if (!currentSeason) {
      return Response.json(
        { error: "League has no current season — create one first." },
        { status: 409 },
      );
    }

    const recalcResult = await recalculateStandings(
      db,
      leagueId,
      currentSeason.id,
      league.constructor_championship_enabled,
      league.penalty_threshold,
    );
    if (!recalcResult.ok) {
      return Response.json({ error: recalcResult.error }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "standings.recalculated",
      actorId: auth.user.id,
      entityId: leagueId,
      entityType: "league",
      metadata: { season_id: currentSeason.id },
    });

    revalidateTag(cacheTag.standings(leagueId), "default");

    return Response.json({ recalculated: true });
  });
}
