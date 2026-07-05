import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ResultStepper,
  type BannedDriverInfo,
  type DriverStandingEntry,
  type LeagueTeam,
  type PenaltyRow,
  type PreviousSessionPoints,
  type QualifyingRow,
  type RaceResultRow,
  type SessionDriver,
  type SessionInfo,
} from "@/components/admin/ResultStepper";
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

  // M9 — a completed session is no longer a dead end: instead of redirecting
  // away, the stepper reopens pre-filled with the published data so an admin
  // can correct a mistyped result. The service's upsert/delete-then-insert
  // writes are already idempotent, so republishing is safe by design.
  const correctionMode = session.status === "completed";

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

  // B3 — surface (never block on) a ban recorded in ANY earlier completed
  // session for this league+season, badging the driver with the specific
  // session they were most recently banned in (not just "last round"), so a
  // ban from two rounds ago — or one published out of order — still shows.
  // Two queries total (session ids, then a single .in() on results), never
  // one query per session.
  const { data: earlierSessions } = await db
    .from("race_sessions")
    .select("id, name, scheduled_at")
    .eq("league_id", leagueId)
    .eq("season_id", session.season_id)
    .eq("status", "completed")
    .lt("scheduled_at", session.scheduled_at);

  let bannedDrivers: BannedDriverInfo[] = [];
  if (earlierSessions && earlierSessions.length > 0) {
    const sessionById = new Map(earlierSessions.map((s) => [s.id, s]));
    const { data: banResults } = await db
      .from("race_results")
      .select("driver_id, race_session_id")
      .in(
        "race_session_id",
        earlierSessions.map((s) => s.id),
      )
      .eq("result_status", "ban");

    const mostRecentBanByDriver = new Map<string, { name: string; scheduled_at: string }>();
    for (const row of banResults ?? []) {
      const banSession = sessionById.get(row.race_session_id);
      if (!banSession) continue;
      const existing = mostRecentBanByDriver.get(row.driver_id);
      if (!existing || banSession.scheduled_at > existing.scheduled_at) {
        mostRecentBanByDriver.set(row.driver_id, banSession);
      }
    }
    bannedDrivers = [...mostRecentBanByDriver.entries()].map(([driver_id, s]) => ({
      driver_id,
      session_name: s.name,
    }));
  }

  // M3 — current season standings, used by the Review step to preview each
  // driver's projected championship total (current -> projected).
  const { data: standingsRows } = await db
    .from("driver_standings")
    .select("driver_id, total_points, wins")
    .eq("league_id", leagueId)
    .eq("season_id", session.season_id);
  const driverStandings: DriverStandingEntry[] = (standingsRows ?? []).map((s) => ({
    driver_id: s.driver_id,
    total_points: s.total_points,
    wins: s.wins,
  }));

  // M9 — correction mode: load this session's already-published data so the
  // stepper reopens pre-filled instead of blank. ResultStepper bypasses the
  // sessionStorage draft entirely in correction mode, so this published data
  // always wins over anything stale left in the browser.
  // A driver who has since left the league roster (`entries` above only
  // includes currently-active drivers) is unioned back in below from their
  // published row, so their result stays editable rather than just preserved
  // untouched by the upsert.
  let initialQualifyingRows: QualifyingRow[] | undefined;
  let initialResultRows: RaceResultRow[] | undefined;
  let initialPenaltyRows: PenaltyRow[] | undefined;
  let previousSessionPoints: PreviousSessionPoints[] = [];
  let departedDrivers: SessionDriver[] = [];

  if (correctionMode) {
    const [
      { data: publishedQualifying },
      { data: publishedResults },
      { data: publishedPenalties },
      { data: reserveAssignments },
    ] = await Promise.all([
      db
        .from("qualifying_results")
        .select("driver_id, team_id, qualifying_position, is_pole")
        .eq("race_session_id", sessionId),
      db
        .from("race_results")
        .select(
          "driver_id, team_id, finishing_position, result_status, fastest_lap, points_awarded, manual_points_adjustment, raw_result, notes",
        )
        .eq("race_session_id", sessionId),
      db
        .from("penalties")
        .select("id, driver_id, penalty_points, reason, status, steward_notes, appeal_notes")
        .eq("race_session_id", sessionId),
      // B7 — reserve coverage lives in its own table, not on race_results.
      db
        .from("race_reserve_assignments")
        .select("reserve_driver_id, original_driver_id")
        .eq("race_session_id", sessionId),
    ]);

    const coveringForByReserve = new Map(
      (reserveAssignments ?? []).map((r) => [r.reserve_driver_id, r.original_driver_id]),
    );

    initialQualifyingRows = (publishedQualifying ?? []).map((q) => ({
      driver_id: q.driver_id,
      is_pole: q.is_pole,
      qualifying_position: q.qualifying_position,
      team_id: q.team_id,
    }));

    initialResultRows = (publishedResults ?? []).map((r) => ({
      covering_for_driver_id: coveringForByReserve.get(r.driver_id) ?? null,
      driver_id: r.driver_id,
      fastest_lap: r.fastest_lap,
      finishing_position: r.finishing_position,
      manual_points_adjustment: r.manual_points_adjustment,
      notes: r.notes ?? "",
      raw_result: r.raw_result ?? "",
      result_status: r.result_status,
      team_id: r.team_id,
    }));

    initialPenaltyRows = (publishedPenalties ?? []).map((p) => ({
      id: p.id,
      appeal_notes: p.appeal_notes ?? "",
      driver_id: p.driver_id,
      penalty_points: p.penalty_points,
      reason: p.reason,
      status: p.status,
      steward_notes: p.steward_notes ?? "",
    }));

    // M3 — this session's own contribution to each driver's current standings
    // total; subtracted in the Review step's projection so a republish never
    // double-counts points this session already contributed.
    previousSessionPoints = (publishedResults ?? []).map((r) => ({
      driver_id: r.driver_id,
      points: r.points_awarded + r.manual_points_adjustment,
    }));

    // Union in drivers present in this session's published data who are no
    // longer on the active roster, so their row stays editable in correction
    // mode. Team comes from their own published row (team at race time, not
    // present-day roster data); identity comes from a minimal `drivers` fetch.
    const activeDriverIds = new Set(drivers.map((d) => d.driver_id));
    const publishedTeamByDriver = new Map<string, string>();
    for (const r of publishedResults ?? []) {
      if (!publishedTeamByDriver.has(r.driver_id)) publishedTeamByDriver.set(r.driver_id, r.team_id);
    }
    for (const q of publishedQualifying ?? []) {
      if (!publishedTeamByDriver.has(q.driver_id)) publishedTeamByDriver.set(q.driver_id, q.team_id);
    }
    const departedDriverIds = [...publishedTeamByDriver.keys()].filter(
      (id) => !activeDriverIds.has(id),
    );

    if (departedDriverIds.length > 0) {
      const { data: departedDriverRows } = await db
        .from("drivers")
        .select("id, display_name, racing_number")
        .in("id", departedDriverIds);
      const teamById = new Map(leagueTeams.map((t) => [t.id, t]));
      departedDrivers = (departedDriverRows ?? []).map((d) => {
        const teamId = publishedTeamByDriver.get(d.id) ?? "";
        const team = teamById.get(teamId);
        return {
          color_hex: team?.color_hex ?? "#444444",
          display_name: d.display_name,
          driver_id: d.id,
          is_reserve: false,
          left_roster: true,
          racing_number: d.racing_number,
          team_id: teamId,
          team_name: team?.name ?? "Unassigned",
        };
      });
    }
  }

  // Normal first-publish path is untouched — departedDrivers is only ever
  // populated in correction mode.
  const rosterDrivers: SessionDriver[] =
    departedDrivers.length > 0 ? [...drivers, ...departedDrivers] : drivers;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={
          correctionMode
            ? "Correct published results for this session"
            : "Publish results for this session"
        }
        title={session.name}
      />
      <ResultStepper
        bannedDrivers={bannedDrivers}
        correctionMode={correctionMode}
        driverStandings={driverStandings}
        drivers={rosterDrivers}
        existingPenaltyTotals={existingPenaltyTotals}
        initialPenaltyRows={initialPenaltyRows}
        initialQualifyingRows={initialQualifyingRows}
        initialResultRows={initialResultRows}
        leagueSlug={league.slug}
        penaltyThreshold={league.penalty_threshold ?? null}
        previousSessionPoints={previousSessionPoints}
        session={sessionInfo}
        teams={leagueTeams}
      />
    </div>
  );
}
