import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { cacheTag } from "@/lib/cache/tags";
import { calculateRacePoints, type PointsSystem } from "@/lib/results/points";
import { recalculateStandings } from "@/lib/results/publish-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import { createPointsSystemSchema } from "../route";

// Editing a points system is retroactive: any already-published session using
// it gets its stored race_results.points_awarded recomputed with the new
// scoring, then standings are rebuilt from those rows. Mirrors the
// adjustments route's "mutate rows, then call recalculateStandings" pattern.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pointsSystemId: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId, pointsSystemId } = await params;
    const body = await req.json();
    const parsed = createPointsSystemSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    const { data: existing, error: existingError } = await db
      .from("points_systems")
      .select("id")
      .eq("id", pointsSystemId)
      .eq("league_id", leagueId)
      .maybeSingle();
    if (existingError) {
      return Response.json({ error: "Failed to load points system" }, { status: 500 });
    }
    if (!existing) {
      return Response.json({ error: "Points system not found" }, { status: 404 });
    }

    const { data: updated, error: updateError } = await db
      .from("points_systems")
      .update(parsed.data)
      .eq("id", pointsSystemId)
      .select("id, name")
      .single();
    if (updateError || !updated) {
      return Response.json({ error: "Failed to update points system" }, { status: 500 });
    }

    const newPointsSystem: PointsSystem = {
      points_by_position: parsed.data.points_by_position,
      fastest_lap_points: parsed.data.fastest_lap_points,
      pole_position_points: parsed.data.pole_position_points,
    };

    // Rescore every published session using this points system.
    const { data: sessions, error: sessionsError } = await db
      .from("race_sessions")
      .select("id, season_id")
      .eq("league_id", leagueId)
      .eq("points_system_id", pointsSystemId)
      .eq("status", "completed");
    if (sessionsError) {
      return Response.json({ error: "Failed to load published sessions" }, { status: 500 });
    }

    const affectedSessions = sessions ?? [];

    if (affectedSessions.length > 0) {
      const { data: league, error: leagueError } = await db
        .from("leagues")
        .select("fastest_lap_enabled, pole_position_enabled, constructor_championship_enabled, penalty_threshold")
        .eq("id", leagueId)
        .single();
      if (leagueError || !league) {
        return Response.json({ error: "Failed to load league" }, { status: 500 });
      }

      for (const session of affectedSessions) {
        const [{ data: results, error: resultsError }, { data: qualifying, error: qualError }] =
          await Promise.all([
            db
              .from("race_results")
              .select("id, driver_id, finishing_position, result_status, fastest_lap")
              .eq("race_session_id", session.id),
            db
              .from("qualifying_results")
              .select("driver_id, is_pole")
              .eq("race_session_id", session.id),
          ]);
        if (resultsError || qualError) {
          return Response.json({ error: "Failed to load session results" }, { status: 500 });
        }

        const poleDriverId = (qualifying ?? []).find((q) => q.is_pole)?.driver_id ?? null;

        for (const r of results ?? []) {
          const points_awarded = calculateRacePoints({
            finishing_position: r.finishing_position,
            result_status: r.result_status,
            is_fastest_lap: r.fastest_lap,
            is_pole: r.driver_id === poleDriverId,
            league_fastest_lap_enabled: league.fastest_lap_enabled,
            league_pole_enabled: league.pole_position_enabled,
            points_system: newPointsSystem,
          });
          const { error: rowUpdateError } = await db
            .from("race_results")
            .update({ points_awarded })
            .eq("id", r.id);
          if (rowUpdateError) {
            return Response.json({ error: "Failed to rescore session results" }, { status: 500 });
          }
        }
      }

      // Recalculate standings once per distinct affected season.
      const seasonIds = [...new Set(affectedSessions.map((s) => s.season_id))];
      for (const seasonId of seasonIds) {
        const recalcResult = await recalculateStandings(
          db,
          leagueId,
          seasonId,
          league.constructor_championship_enabled,
          league.penalty_threshold,
        );
        if (!recalcResult.ok) {
          return Response.json({ error: recalcResult.error }, { status: 500 });
        }
      }
    }

    await writeAdminAuditLog({
      action: "points_system.updated",
      actorId: auth.user.id,
      entityId: updated.id,
      entityType: "points_system",
      metadata: {
        league_id: leagueId,
        name: parsed.data.name,
        rescored_session_count: affectedSessions.length,
      },
    });

    revalidateTag(cacheTag.standings(leagueId), "default");
    revalidateTag(cacheTag.results(leagueId), "default");

    return Response.json({
      points_system: updated,
      rescored_session_count: affectedSessions.length,
    });
  });
}
