import "server-only";

import { notFound, redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ResultStepper, type LeagueTeam, type SessionDriver, type SessionInfo } from "@/components/admin/ResultStepper";
import { ErrorState } from "@/components/ui/ErrorState";
import { getDriverPenaltyTotals } from "@/lib/penalties/get-driver-penalty-totals";
import { resolveStintForDate } from "@/lib/results/publish-service";
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
        "id, name, status, league_id, season_id, scheduled_at, points_systems(points_by_position, fastest_lap_points, pole_position_points)",
      )
      .eq("id", sessionId)
      .eq("league_id", leagueId)
      .single(),
    db
      .from("leagues")
      .select("id, fastest_lap_enabled, pole_position_enabled, penalty_threshold, slug")
      .eq("id", leagueId)
      .single(),
    db
      .from("league_driver_entries")
      .select(
        "driver_id, is_reserve, drivers(display_name, racing_number), driver_team_stints(team_id, starts_on, ends_on, teams(name, color_hex))",
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

  // M7 — resolve each driver's team as of the session's own date, not
  // whichever stint happens to be active "now". A later transfer must not
  // silently rewrite an older session's constructor history on publish.
  const scheduledDate = session.scheduled_at.slice(0, 10);

  const drivers: SessionDriver[] = (entries ?? []).map((entry) => {
    const driver = entry.drivers as unknown as {
      display_name: string;
      racing_number: number | null;
    } | null;
    const stints = (entry.driver_team_stints ?? []) as unknown as Array<{
      starts_on: string;
      ends_on: string | null;
      team_id: string;
      teams: { color_hex: string; name: string } | null;
    }>;
    const resolvedStint = resolveStintForDate(stints, scheduledDate);
    const activeStint = stints.find((s) => s.ends_on === null);
    return {
      color_hex: resolvedStint?.teams?.color_hex ?? "#444444",
      display_name: driver?.display_name ?? "Unknown",
      driver_id: entry.driver_id,
      is_reserve: entry.is_reserve,
      present_team_id: activeStint?.team_id ?? resolvedStint?.team_id ?? "",
      racing_number: driver?.racing_number ?? null,
      team_id: resolvedStint?.team_id ?? "",
      team_name: resolvedStint?.teams?.name ?? "Unassigned",
    };
  });

  const leagueTeams: LeagueTeam[] = (teams ?? []).map((t) => ({
    color_hex: t.color_hex,
    id: t.id,
    name: t.name,
  }));

  // Prior-season-inclusive penalty totals (driver_penalty_totals), used so the
  // review step can warn against the league's real ban threshold instead of
  // just flagging any formal penalty (B2).
  const penaltyTotals = await getDriverPenaltyTotals(db, leagueId, session.season_id);
  const existingPenaltyTotals = drivers.map((d) => ({
    driver_id: d.driver_id,
    penalty_points: penaltyTotals.get(d.driver_id)?.penaltyPoints ?? 0,
  }));

  // B3 — surface (never block on) a ban recorded in the immediately previous
  // session for this league+season, so it doesn't silently vanish from view
  // the next time this roster is entered.
  // ponytail: only the one prior session is checked; a durable ban ledger
  // across every session since the ban is the upgrade path if needed.
  const { data: previousSession } = await db
    .from("race_sessions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("season_id", session.season_id)
    .eq("status", "completed")
    .lt("scheduled_at", session.scheduled_at)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let bannedLastRoundDriverIds: string[] = [];
  if (previousSession) {
    const { data: banResults } = await db
      .from("race_results")
      .select("driver_id")
      .eq("race_session_id", previousSession.id)
      .eq("result_status", "ban");
    bannedLastRoundDriverIds = (banResults ?? []).map((r) => r.driver_id);
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Publish results for this session`}
        title={session.name}
      />
      <ResultStepper
        bannedLastRoundDriverIds={bannedLastRoundDriverIds}
        drivers={drivers}
        existingPenaltyTotals={existingPenaltyTotals}
        leagueSlug={league.slug}
        penaltyThreshold={league.penalty_threshold ?? null}
        session={sessionInfo}
        teams={leagueTeams}
      />
    </div>
  );
}
