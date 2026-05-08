import "server-only";

import { notFound, redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ResultStepper, type LeagueTeam, type SessionDriver, type SessionInfo } from "@/components/admin/ResultStepper";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function SessionPublishPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: leagueId, sessionId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: session, error: sessionError },
    { data: league },
    { data: entries, error: entriesError },
    { data: teams },
  ] = await Promise.all([
    db
      .from("race_sessions")
      .select(
        "id, name, status, league_id, points_systems(points_by_position, fastest_lap_points, pole_position_points)",
      )
      .eq("id", sessionId)
      .eq("league_id", leagueId)
      .single(),
    db
      .from("leagues")
      .select("id, fastest_lap_enabled, pole_position_enabled")
      .eq("id", leagueId)
      .single(),
    db
      .from("league_driver_entries")
      .select(
        "driver_id, is_reserve, drivers(display_name, racing_number), driver_team_stints(team_id, ends_on, teams(name, color_hex))",
      )
      .eq("league_id", leagueId)
      .is("left_on", null)
      .order("joined_on"),
    db
      .from("teams")
      .select("id, name, color_hex")
      .eq("league_id", leagueId)
      .order("name"),
  ]);

  if (sessionError && sessionError.code !== "PGRST116") {
    return <ErrorState message="Failed to load session." />;
  }
  if (!session || !league) notFound();
  if (entriesError) {
    return <ErrorState message="Failed to load driver roster." />;
  }

  // Already published — redirect to league admin
  if (session.status === "completed") {
    redirect(`/admin/leagues/${leagueId}`);
  }

  const ps = session.points_systems as unknown as {
    fastest_lap_points: number;
    points_by_position: Record<string, number>;
    pole_position_points: number;
  } | null;

  if (!ps) {
    return <ErrorState message="No points system attached to this session." />;
  }

  const sessionInfo: SessionInfo = {
    fastest_lap_enabled: league.fastest_lap_enabled,
    id: session.id,
    league_id: leagueId,
    name: session.name,
    pole_position_enabled: league.pole_position_enabled,
    points_system: ps,
  };

  const drivers: SessionDriver[] = (entries ?? []).map((entry) => {
    const driver = entry.drivers as unknown as {
      display_name: string;
      racing_number: number | null;
    } | null;
    const stints = entry.driver_team_stints as unknown as Array<{
      ends_on: string | null;
      team_id: string;
      teams: { color_hex: string; name: string } | null;
    }> | null;
    const activeStint = stints?.find((s) => s.ends_on === null);
    return {
      color_hex: activeStint?.teams?.color_hex ?? "#444444",
      display_name: driver?.display_name ?? "Unknown",
      driver_id: entry.driver_id,
      racing_number: driver?.racing_number ?? null,
      team_id: activeStint?.team_id ?? "",
      team_name: activeStint?.teams?.name ?? "Unassigned",
    };
  });

  const leagueTeams: LeagueTeam[] = (teams ?? []).map((t) => ({
    color_hex: t.color_hex,
    id: t.id,
    name: t.name,
  }));

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Publish results for this session`}
        title={session.name}
      />
      <ResultStepper drivers={drivers} session={sessionInfo} teams={leagueTeams} />
    </div>
  );
}
