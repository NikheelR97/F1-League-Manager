import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { MAX_WORKBOOK_DRIVERS, MAX_WORKBOOK_RACES } from "@/lib/constants";
import { calculateRacePoints } from "@/lib/results/points";
import type { PointsSystem } from "@/lib/results/points";
import { buildDriverStandings, buildTeamStandings } from "@/lib/results/standings";

import type { ParsedWorkbook } from "./types";

// ---------------------------------------------------------------------------
// Standard F1 points (the only points scheme this workbook uses)
// ---------------------------------------------------------------------------
const STANDARD_POINTS_BY_POSITION: Record<string, number> = {
  "1": 25, "2": 18, "3": 15, "4": 12, "5": 10,
  "6": 8, "7": 6, "8": 4, "9": 2, "10": 1,
};

// Slug → (circuit_id, starts_on) loaded once from DB.
type CircuitRow = { id: string; slug: string; starts_on: string | null };

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ImportResult {
  ok: true;
  sessionCount: number;
  driverCount: number;
}

export interface ImportError {
  ok: false;
  error: string;
}

export interface ComputedStandings {
  drivers: Array<{ driver_id: string; name: string; total_points: number }>;
  constructors: Array<{ team_id: string; name: string; total_points: number }>;
}

// ---------------------------------------------------------------------------
// Team name normalisation — workbook names → canonical display names
// ---------------------------------------------------------------------------
const TEAM_NAME_ALIASES: Record<string, string> = {
  "Red Bull": "Red Bull Racing",
  "RB": "Racing Bulls",
  "KICK Sauber": "Kick Sauber",
};

function canonicalTeamName(raw: string): string {
  return TEAM_NAME_ALIASES[raw] ?? raw;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Main import
// ---------------------------------------------------------------------------

export async function runImport(
  workbook: ParsedWorkbook,
  leagueId: string,
  seasonId: string,
  actorId: string,
): Promise<ImportResult | ImportError> {
  const db = createSupabaseServiceRoleClient();

  // 1. Verify league + season exist
  const [{ data: league }, { data: season }] = await Promise.all([
    db.from("leagues").select("id, fastest_lap_enabled, pole_position_enabled, constructor_championship_enabled, penalty_threshold").eq("id", leagueId).single(),
    db.from("seasons").select("id").eq("id", seasonId).single(),
  ]);
  if (!league) return { ok: false, error: "League not found" };
  if (!season) return { ok: false, error: "Season not found" };

  // 2. Load circuits indexed by slug
  const { data: circuitsRaw } = await db
    .from("circuits")
    .select("id, slug, starts_on")
    .in("slug", workbook.races.map((r) => r.circuitSlug));
  const circuitMap = new Map<string, CircuitRow>(
    (circuitsRaw ?? []).map((c) => [c.slug, c]),
  );

  const missingSlugs = workbook.races
    .map((r) => r.circuitSlug)
    .filter((s) => !circuitMap.has(s));
  if (missingSlugs.length > 0) {
    return { ok: false, error: `Circuits not found in DB: ${missingSlugs.join(", ")}` };
  }

  // 3. Find or create teams for this league
  const allTeamNames = new Set<string>();
  for (const d of workbook.drivers) {
    if (d.currentTeam) allTeamNames.add(canonicalTeamName(d.currentTeam));
    if (d.previousTeam) allTeamNames.add(canonicalTeamName(d.previousTeam));
  }
  for (const rd of workbook.raceData) {
    for (const r of rd.results) {
      if (r.reserveTeam) allTeamNames.add(canonicalTeamName(r.reserveTeam));
    }
  }

  const { data: existingTeams } = await db
    .from("teams")
    .select("id, name, slug")
    .eq("league_id", leagueId);

  const teamMap = new Map<string, string>(); // canonical name → team_id
  for (const t of existingTeams ?? []) {
    teamMap.set(t.name, t.id);
  }

  // Load official templates for colour + kind lookup
  const { data: templates } = await db
    .from("official_team_templates")
    .select("id, name, slug, color_hex");
  const templateByName = new Map(
    (templates ?? []).map((t) => [t.name, t]),
  );

  for (const name of allTeamNames) {
    if (teamMap.has(name)) continue;
    const slug = toSlug(name);
    const tmpl = templateByName.get(name);
    const { data: newTeam, error: teamErr } = await db
      .from("teams")
      .insert({
        league_id: leagueId,
        name,
        slug: slug || `team-${Date.now()}`,
        kind: tmpl ? "official" : "custom",
        official_template_id: tmpl?.id ?? null,
        color_hex: tmpl?.color_hex ?? "#888888",
      })
      .select("id")
      .single();
    if (teamErr || !newTeam) return { ok: false, error: `Failed to create team "${name}": ${teamErr?.message ?? "unknown"}` };
    teamMap.set(name, newTeam.id);
  }

  // 4. Find or create drivers + league_driver_entries
  const { data: existingDrivers } = await db
    .from("drivers")
    .select("id, display_name");
  const driverByName = new Map<string, string>( // display_name → driver_id
    (existingDrivers ?? []).map((d) => [d.display_name, d.id]),
  );

  const entryByDriver = new Map<string, string>(); // driver_id → entry_id

  for (const pd of workbook.drivers) {
    const existingDriverId = driverByName.get(pd.name);
    let driverId: string;
    if (existingDriverId) {
      driverId = existingDriverId;
    } else {
      const { data: nd, error: dErr } = await db
        .from("drivers")
        .insert({ display_name: pd.name, is_active: true })
        .select("id")
        .single();
      if (dErr || !nd) return { ok: false, error: `Failed to create driver "${pd.name}"` };
      driverId = nd.id;
      driverByName.set(pd.name, driverId);
    }

    const isReserve = !pd.currentTeam;
    const { data: entry, error: entryErr } = await db
      .from("league_driver_entries")
      .upsert(
        {
          league_id: leagueId,
          season_id: seasonId,
          driver_id: driverId,
          is_reserve: isReserve,
          joined_on: "2025-01-01",
          carry_over_penalty_points: pd.carryOverPenaltyPoints,
          carry_over_ban_count: pd.carryOverRaceBans,
        },
        { onConflict: "league_id,season_id,driver_id" },
      )
      .select("id")
      .single();
    if (entryErr || !entry) return { ok: false, error: `Failed to upsert driver entry for "${pd.name}"` };
    entryByDriver.set(driverId, entry.id);
  }

  // Also register reserve drivers found only in race results (not in LM driver list)
  for (const rd of workbook.raceData) {
    for (const res of rd.results) {
      if (driverByName.has(res.driverName)) continue;
      const { data: nd, error: dErr } = await db
        .from("drivers")
        .insert({ display_name: res.driverName, is_active: true })
        .select("id")
        .single();
      if (dErr || !nd) return { ok: false, error: `Failed to create driver "${res.driverName}"` };
      driverByName.set(res.driverName, nd.id);
    }
  }

  // Ensure every driver in race results has a league_driver_entry
  for (const rd of workbook.raceData) {
    for (const res of rd.results) {
      const driverId = driverByName.get(res.driverName)!;
      if (entryByDriver.has(driverId)) continue;
      const { data: entry, error: entryErr } = await db
        .from("league_driver_entries")
        .upsert(
          {
            league_id: leagueId,
            season_id: seasonId,
            driver_id: driverId,
            is_reserve: true,
            joined_on: "2025-01-01",
            carry_over_penalty_points: 0,
            carry_over_ban_count: 0,
          },
          { onConflict: "league_id,season_id,driver_id" },
        )
        .select("id")
        .single();
      if (entryErr || !entry) return { ok: false, error: `Failed to upsert reserve entry for "${res.driverName}"` };
      entryByDriver.set(driverId, entry.id);
    }
  }

  // 5. Create driver_team_stints for current (and previous) team assignments
  for (const pd of workbook.drivers) {
    const driverId = driverByName.get(pd.name);
    if (!driverId) continue;
    const entryId = entryByDriver.get(driverId);
    if (!entryId) continue;

    const currentTeamId = pd.currentTeam ? teamMap.get(canonicalTeamName(pd.currentTeam)) : null;
    const previousTeamId = pd.previousTeam ? teamMap.get(canonicalTeamName(pd.previousTeam)) : null;

    // Delete and recreate stints to allow idempotent re-import
    await db.from("driver_team_stints").delete().eq("league_driver_entry_id", entryId);

    if (pd.transferAfterRace && previousTeamId && currentTeamId) {
      await db.from("driver_team_stints").insert([
        {
          league_driver_entry_id: entryId,
          team_id: previousTeamId,
          starts_on: "2025-01-01",
          ends_on: "2025-12-31",
        },
        {
          league_driver_entry_id: entryId,
          team_id: currentTeamId,
          starts_on: "2025-12-31",
          ends_on: null,
        },
      ]);
    } else if (currentTeamId) {
      await db.from("driver_team_stints").insert({
        league_driver_entry_id: entryId,
        team_id: currentTeamId,
        starts_on: "2025-01-01",
        ends_on: null,
      });
    }
  }

  // 6. Find or create points system for the league
  const { data: existingPS } = await db
    .from("points_systems")
    .select("id")
    .eq("league_id", leagueId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  let pointsSystemId: string;
  if (existingPS) {
    pointsSystemId = existingPS.id;
  } else {
    const { data: newPS, error: psErr } = await db
      .from("points_systems")
      .insert({
        league_id: leagueId,
        name: "Standard F1",
        points_by_position: STANDARD_POINTS_BY_POSITION,
        fastest_lap_points: 0,
        pole_position_points: 0,
        max_positions: 10,
      })
      .select("id")
      .single();
    if (psErr || !newPS) return { ok: false, error: "Failed to create points system" };
    pointsSystemId = newPS.id;
  }

  // Load the points system for calculateRacePoints
  const { data: psRow } = await db
    .from("points_systems")
    .select("points_by_position, fastest_lap_points, pole_position_points, max_positions")
    .eq("id", pointsSystemId)
    .single();
  const ps = psRow as unknown as PointsSystem | null;
  if (!ps) return { ok: false, error: "Failed to load points system" };

  // 7. Determine team for each driver at each race (considering transfers)
  // Build a helper: given a driverName and race ORDER (1-indexed), return the team.
  const driverTransfers = new Map<string, { previousTeam: string; afterRaceOrder: number; currentTeam: string }>();
  for (const pd of workbook.drivers) {
    if (pd.transferAfterRace && pd.previousTeam && pd.currentTeam) {
      driverTransfers.set(pd.name, {
        previousTeam: canonicalTeamName(pd.previousTeam),
        afterRaceOrder: pd.transferAfterRace,
        currentTeam: canonicalTeamName(pd.currentTeam),
      });
    }
  }

  function resolveTeamId(driverName: string, raceOrder: number, reserveTeam: string | null): string | null {
    if (reserveTeam) return teamMap.get(canonicalTeamName(reserveTeam)) ?? null;
    const transfer = driverTransfers.get(driverName);
    if (transfer) {
      return raceOrder <= transfer.afterRaceOrder
        ? (teamMap.get(transfer.previousTeam) ?? null)
        : (teamMap.get(transfer.currentTeam) ?? null);
    }
    // Find driver in workbook driver list for current team
    const pd = workbook.drivers.find((d) => d.name === driverName);
    if (pd?.currentTeam) return teamMap.get(canonicalTeamName(pd.currentTeam)) ?? null;
    return null;
  }

  // 8. Create race sessions + write results
  const sessionIds: string[] = [];

  for (const rd of workbook.raceData) {
    const circuit = circuitMap.get(rd.race.circuitSlug);
    if (!circuit) continue;

    const sessionCode = `IMP${String(rd.race.order).padStart(3, "0")}`;
    const raceLengthPercent = rd.race.format === "Sprint" ? 25 : 50;
    const scheduledAt = circuit.starts_on
      ? rd.race.format === "Sprint"
        ? new Date(new Date(circuit.starts_on).getTime() - 86400_000).toISOString()
        : new Date(circuit.starts_on).toISOString()
      : new Date("2025-06-01").toISOString();

    const sessionName = `Round ${rd.race.order} — ${rd.race.name}${rd.race.format === "Sprint" ? " Sprint" : ""}`;

    // Upsert session by (league_id, season_id, session_code) — unique per S9 migration
    const { data: session, error: sessErr } = await db
      .from("race_sessions")
      .upsert(
        {
          league_id: leagueId,
          season_id: seasonId,
          circuit_id: circuit.id,
          points_system_id: pointsSystemId,
          name: sessionName,
          session_code: sessionCode,
          race_number: 1,
          race_length_percent: raceLengthPercent,
          scheduled_at: scheduledAt,
          status: "completed",
          published_at: new Date().toISOString(),
        },
        { onConflict: "league_id,season_id,session_code" },
      )
      .select("id")
      .single();

    if (sessErr || !session) {
      return { ok: false, error: `Failed to upsert session "${sessionName}": ${sessErr?.message ?? "unknown"}` };
    }

    const sessionId = session.id;
    sessionIds.push(sessionId);

    // Clear existing results for this session (idempotent re-import)
    await Promise.all([
      db.from("qualifying_results").delete().eq("race_session_id", sessionId),
      db.from("race_results").delete().eq("race_session_id", sessionId),
      db.from("penalties").delete().eq("race_session_id", sessionId),
    ]);

    // Build qualifying entries (only for drivers with valid grid position, no BAN/DSQ exception)
    const qualifyingRows: Array<{
      race_session_id: string;
      driver_id: string;
      team_id: string;
      qualifying_position: number;
      is_pole: boolean;
    }> = [];

    const raceResultRows: Array<{
      race_session_id: string;
      driver_id: string;
      team_id: string;
      finishing_position: number | null;
      result_status: string;
      fastest_lap: boolean;
      points_awarded: number;
      penalty_points: number;
      manual_points_adjustment: number;
      raw_result: string;
      notes: string | null;
    }> = [];

    const penaltyRows: Array<{
      league_id: string;
      season_id: string;
      driver_id: string;
      race_session_id: string;
      penalty_points: number;
      reason: string;
      status: string;
      issued_by: string | null;
    }> = [];

    // Find the pole sitter (grid position 1, no qualy exception)
    const poleSitter = rd.results.find(
      (r) => r.gridPosition === 1 && !r.qualyException,
    );
    const poleDriverName = poleSitter?.driverName ?? null;

    for (const res of rd.results) {
      const driverId = driverByName.get(res.driverName);
      if (!driverId) continue;
      const teamId = resolveTeamId(res.driverName, rd.race.order, res.reserveTeam);
      if (!teamId) continue; // skip unresolvable team — reserve with no team

      // Qualifying result
      if (
        res.gridPosition !== null &&
        res.gridPosition >= 1 &&
        !res.qualyException
      ) {
        qualifyingRows.push({
          race_session_id: sessionId,
          driver_id: driverId,
          team_id: teamId,
          qualifying_position: res.gridPosition,
          is_pole: res.driverName === poleDriverName,
        });
      }

      // Race result
      const pointsAwarded = calculateRacePoints({
        finishing_position: res.finishingPosition,
        result_status: res.resultStatus,
        is_fastest_lap: res.fastestLap,
        is_pole: res.driverName === poleDriverName,
        league_fastest_lap_enabled: league.fastest_lap_enabled,
        league_pole_enabled: league.pole_position_enabled,
        points_system: ps,
      });

      raceResultRows.push({
        race_session_id: sessionId,
        driver_id: driverId,
        team_id: teamId,
        finishing_position: res.finishingPosition,
        result_status: res.resultStatus,
        fastest_lap: res.fastestLap,
        points_awarded: pointsAwarded,
        penalty_points: res.penaltyPoints,
        manual_points_adjustment: res.manualChampPoints,
        raw_result: res.resultRaw,
        notes: null,
      });

      // Penalty row (only when penalty points > 0)
      if (res.penaltyPoints > 0) {
        penaltyRows.push({
          league_id: leagueId,
          season_id: seasonId,
          driver_id: driverId,
          race_session_id: sessionId,
          penalty_points: res.penaltyPoints,
          reason: "Imported from workbook",
          status: "open",
          issued_by: actorId,
        });
      }
    }

    // Insert qualifying results (sort to avoid position conflicts)
    if (qualifyingRows.length > 0) {
      qualifyingRows.sort((a, b) => a.qualifying_position - b.qualifying_position);
      const { error: qErr } = await db.from("qualifying_results").insert(qualifyingRows);
      if (qErr) return { ok: false, error: `Failed to write qualifying results for "${rd.race.name}": ${qErr.message}` };
    }

    // Insert race results (sort by finishing position first)
    if (raceResultRows.length > 0) {
      raceResultRows.sort((a, b) => (a.finishing_position ?? 99) - (b.finishing_position ?? 99));
      const { error: rrErr } = await db.from("race_results").insert(raceResultRows);
      if (rrErr) return { ok: false, error: `Failed to write race results for "${rd.race.name}": ${rrErr.message}` };
    }

    if (penaltyRows.length > 0) {
      const { error: penErr } = await db.from("penalties").insert(penaltyRows);
      if (penErr) return { ok: false, error: `Failed to write penalties for "${rd.race.name}": ${penErr.message}` };
    }
  }

  // 9. Recalculate standings
  const recalcResult = await recalculate(db, leagueId, seasonId, league);
  if (!recalcResult.ok) return recalcResult;

  return { ok: true, sessionCount: sessionIds.length, driverCount: workbook.drivers.length };
}

// ---------------------------------------------------------------------------
// Fetch computed standings for diff comparison
// ---------------------------------------------------------------------------

export async function fetchComputedStandings(
  leagueId: string,
  seasonId: string,
): Promise<ComputedStandings> {
  const db = createSupabaseServiceRoleClient();

  const [{ data: driverRows }, { data: teamRows }] = await Promise.all([
    db
      .from("driver_standings")
      .select("driver_id, total_points, drivers(display_name)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position"),
    db
      .from("team_standings")
      .select("team_id, total_points, teams(name)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position"),
  ]);

  const drivers = (driverRows ?? []).map((r) => ({
    driver_id: r.driver_id,
    name: (r.drivers as unknown as { display_name: string } | null)?.display_name ?? r.driver_id,
    total_points: r.total_points,
  }));

  const constructors = (teamRows ?? []).map((r) => ({
    team_id: r.team_id,
    name: (r.teams as unknown as { name: string } | null)?.name ?? r.team_id,
    total_points: r.total_points,
  }));

  return { drivers, constructors };
}

// ---------------------------------------------------------------------------
// Internal: recalculate standings after import
// ---------------------------------------------------------------------------

async function recalculate(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  leagueId: string,
  seasonId: string,
  league: {
    constructor_championship_enabled: boolean;
    penalty_threshold: number;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {

  const { data: completedSessions } = await db
    .from("race_sessions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId)
    .eq("status", "completed");

  const sessionIds = (completedSessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return { ok: true };

  const [{ data: allResults }, { data: adjustments }] = await Promise.all([
    db
      .from("race_results")
      .select("driver_id, team_id, finishing_position, result_status, points_awarded, manual_points_adjustment, fastest_lap")
      .in("race_session_id", sessionIds)
      .limit(MAX_WORKBOOK_RACES * MAX_WORKBOOK_DRIVERS),
    db
      .from("championship_adjustments")
      .select("driver_id, team_id, points_delta")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId),
  ]);

  const prevDriverPositions = new Map<string, number>();
  const prevTeamPositions = new Map<string, number>();
  const latestTeamByDriver = new Map<string, string>();
  for (const r of allResults ?? []) {
    if (r.team_id) latestTeamByDriver.set(r.driver_id, r.team_id);
  }

  const newDriverStandings = buildDriverStandings(allResults ?? [], adjustments ?? [], prevDriverPositions);

  await db.from("driver_standings").delete().eq("league_id", leagueId).eq("season_id", seasonId);
  if (newDriverStandings.length > 0) {
    const { error } = await db.from("driver_standings").insert(
      newDriverStandings.map((s) => ({
        league_id: leagueId,
        season_id: seasonId,
        driver_id: s.driver_id,
        team_id: latestTeamByDriver.get(s.driver_id) ?? null,
        position: s.position,
        previous_position: null,
        total_points: s.total_points,
        wins: s.wins,
        podiums: s.podiums,
        fastest_laps: s.fastest_laps,
      })),
    );
    if (error) return { ok: false, error: "Failed to write driver standings" };
  }

  if (league.constructor_championship_enabled) {
    const newTeamStandings = buildTeamStandings(allResults ?? [], adjustments ?? [], prevTeamPositions);
    await db.from("team_standings").delete().eq("league_id", leagueId).eq("season_id", seasonId);
    if (newTeamStandings.length > 0) {
      const { error } = await db.from("team_standings").insert(
        newTeamStandings.map((s) => ({
          league_id: leagueId,
          season_id: seasonId,
          team_id: s.team_id,
          position: s.position,
          previous_position: null,
          total_points: s.total_points,
          wins: s.wins,
          podiums: s.podiums,
        })),
      );
      if (error) return { ok: false, error: "Failed to write team standings" };
    }
  }

  return { ok: true };
}
