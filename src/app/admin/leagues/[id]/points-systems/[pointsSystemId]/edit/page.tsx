import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PointsSystemForm } from "@/components/admin/PointsSystemForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function EditPointsSystemPage({
  params,
}: {
  params: Promise<{ id: string; pointsSystemId: string }>;
}) {
  const { id: leagueId, pointsSystemId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [{ data: league, error: leagueError }, { data: pointsSystem, error: pointsSystemError }] =
    await Promise.all([
      db.from("leagues").select("id, name").eq("id", leagueId).single(),
      db
        .from("points_systems")
        .select("id, name, points_by_position, fastest_lap_points, pole_position_points, max_positions")
        .eq("id", pointsSystemId)
        .eq("league_id", leagueId)
        .maybeSingle(),
    ]);

  if (leagueError && leagueError.code !== "PGRST116") {
    return <ErrorState message="Failed to load league." />;
  }
  if (pointsSystemError) {
    return <ErrorState message="Failed to load points system." />;
  }
  if (!league || !pointsSystem) notFound();

  const { count: publishedSessionCount } = await db
    .from("race_sessions")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("points_system_id", pointsSystemId)
    .eq("status", "completed");

  const initialPositions = Object.entries(pointsSystem.points_by_position as Record<string, number>)
    .map(([position, points]) => ({ points, position: Number(position) }))
    .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Edit scoring for ${league.name}`}
        title={`Edit Points System: ${pointsSystem.name}`}
      />
      <div className="max-w-xl">
        <PointsSystemForm
          initialPositions={initialPositions}
          initialValues={{
            fastest_lap_points: pointsSystem.fastest_lap_points,
            max_positions: pointsSystem.max_positions,
            name: pointsSystem.name,
            pole_position_points: pointsSystem.pole_position_points,
          }}
          leagueId={leagueId}
          pointsSystemId={pointsSystem.id}
          publishedSessionCount={publishedSessionCount ?? 0}
        />
      </div>
    </div>
  );
}
