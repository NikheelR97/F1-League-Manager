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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid adjustment id" }, { status: 422 });
    }
    const { id: adjustmentId } = parsedParams.data;

    const db = createSupabaseServiceRoleClient();

    const { data: adjustment, error: fetchError } = await db
      .from("championship_adjustments")
      .select("id, league_id, season_id, adjustment_kind, driver_id, team_id, points_delta, reason")
      .eq("id", adjustmentId)
      .single();

    if (fetchError || !adjustment) {
      return Response.json({ error: "Adjustment not found" }, { status: 404 });
    }

    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("constructor_championship_enabled, penalty_threshold")
      .eq("id", adjustment.league_id)
      .single();

    if (leagueError || !league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    const { error: deleteError } = await db
      .from("championship_adjustments")
      .delete()
      .eq("id", adjustmentId);

    if (deleteError) {
      return Response.json({ error: "Failed to delete adjustment" }, { status: 500 });
    }

    // Same recalculation publish/penalty routes use — removing a wrong
    // adjustment changes standings totals immediately.
    const recalcResult = await recalculateStandings(
      db,
      adjustment.league_id,
      adjustment.season_id,
      league.constructor_championship_enabled,
      league.penalty_threshold,
    );

    if (!recalcResult.ok) {
      return Response.json({ error: recalcResult.error }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "adjustment.deleted",
      actorId: auth.user.id,
      entityId: adjustmentId,
      entityType: "championship_adjustment",
      metadata: {
        adjustment_kind: adjustment.adjustment_kind,
        driver_id: adjustment.driver_id,
        league_id: adjustment.league_id,
        points_delta: adjustment.points_delta,
        reason: adjustment.reason,
        season_id: adjustment.season_id,
        team_id: adjustment.team_id,
      },
    });

    revalidateTag(cacheTag.standings(adjustment.league_id), "default");

    return Response.json({ ok: true });
  });
}
