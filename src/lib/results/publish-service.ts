import "server-only";

import { writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { calculateRacePoints, type PointsSystem } from "./points";
import {
  buildDriverStandings,
  buildPenaltyTotals,
  buildTeamStandings,
} from "./standings";

// ---------------------------------------------------------------------------
// Input types (already Zod-validated by the API route before this is called)
// ---------------------------------------------------------------------------

export interface QualifyingEntry {
  driver_id: string;
  team_id: string;
  qualifying_position: number;
  is_pole: boolean;
}

export interface RaceResultEntry {
  driver_id: string;
  team_id: string;
  finishing_position: number | null;
  result_status: "classified" | "dnf" | "dns" | "dsq" | "ban";
  fastest_lap: boolean;
  manual_points_adjustment: number;
  raw_result: string | null;
  notes: string | null;
  // B7 — set only for a reserve driver's row; identifies the primary driver
  // they covered for this session. Null/omitted means no reserve assignment
  // is recorded (soft-optional, never blocks publish).
  covering_for_driver_id?: string | null;
}

export interface PenaltyEntry {
  driver_id: string;
  penalty_points: number;
  reason: string;
  status: "open" | "served" | "appealed" | "rescinded";
  steward_notes: string | null;
  appeal_notes: string | null;
}

export interface PublishInput {
  sessionId: string;
  leagueId: string;
  qualifying: QualifyingEntry[];
  results: RaceResultEntry[];
  penalties: PenaltyEntry[];
  actorId: string;
  // M9 — explicit opt-in to publish over an already-completed session (the
  // publish/page.tsx correction flow). Absent/false keeps the normal
  // first-publish guard that rejects a completed session with 409.
  republish?: boolean;
}

export type PublishResult =
  | { ok: true; sessionId: string }
  | { ok: false; status: number; error: string };

// ---------------------------------------------------------------------------
// Cross-field validation (exported for unit tests)
// ---------------------------------------------------------------------------

export interface ResultsValidationError {
  ok: false;
  status: 422;
  error: string;
}

export function validatePublishResults(
  results: RaceResultEntry[],
): ResultsValidationError | null {
  const classified = results.filter(
    (r) => r.result_status === "classified" && r.finishing_position !== null,
  );
  if (classified.length === 0) {
    return { ok: false, status: 422, error: "At least one driver must be classified with a finishing position" };
  }
  const positions = classified.map((r) => r.finishing_position!);
  if (new Set(positions).size !== positions.length) {
    return { ok: false, status: 422, error: "Duplicate finishing positions detected" };
  }
  if (results.filter((r) => r.fastest_lap).length > 1) {
    return { ok: false, status: 422, error: "Only one driver may have the fastest lap" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Roster team resolution (exported for unit tests) — M7
// ---------------------------------------------------------------------------

// A driver's team as of a specific date is the stint whose [starts_on, ends_on)
// range contains it, falling back to the still-active stint, then to any
// stint. Used so a historical session's publish form prefills the team the
// driver actually raced for, not whatever team a later transfer left them on.
export function resolveStintForDate<T extends { starts_on: string; ends_on: string | null }>(
  stints: T[],
  date: string,
): T | undefined {
  const atDate = stints.find(
    (s) => s.starts_on <= date && (s.ends_on === null || date < s.ends_on),
  );
  const active = stints.find((s) => s.ends_on === null);
  return atDate ?? active ?? stints[0];
}

// ---------------------------------------------------------------------------
// Reserve assignment rows (exported for unit tests) — B7
// ---------------------------------------------------------------------------

export interface ReserveAssignmentRow {
  race_session_id: string;
  original_driver_id: string;
  reserve_driver_id: string;
  team_id: string;
  assigned_by: string;
}

// ponytail: only writes a row when the admin named who the reserve covered
// for (original_driver_id is NOT NULL in the schema); left blank, no
// assignment is recorded rather than blocking publish over it.
export function buildReserveAssignmentRows(
  results: RaceResultEntry[],
  sessionId: string,
  actorId: string,
): ReserveAssignmentRow[] {
  return results
    .filter((r) => !!r.covering_for_driver_id)
    .map((r) => ({
      race_session_id: sessionId,
      original_driver_id: r.covering_for_driver_id!,
      reserve_driver_id: r.driver_id,
      team_id: r.team_id,
      assigned_by: actorId,
    }));
}

// ---------------------------------------------------------------------------
// Per-driver formal penalty total for this session (exported for unit tests)
// ---------------------------------------------------------------------------

// race_results.penalty_points is derived from this — never client-supplied —
// so the per-session penalty display can't drift from the actual penalty
// records (B1). Rescinded decisions don't count.
export function computeSessionPenaltyTotals(
  penalties: PenaltyEntry[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of penalties) {
    if (p.status !== "rescinded") {
      totals.set(p.driver_id, (totals.get(p.driver_id) ?? 0) + p.penalty_points);
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Drop untouched default rows before publish (exported for unit tests) — N2
// ---------------------------------------------------------------------------

// The results step gives every roster driver (including reserves/free agents
// not entered in this session) a default "classified" row with a null
// finishing_position. An untouched default carries no participation signal,
// so it's dropped rather than published as a phantom classified/0-point row
// — it was already excluded from validatePublishResults's classified-count
// and duplicate-position checks, and calculateRacePoints scores it 0 either
// way. Mirrors the qualifying step, which already drops untouched rows
// before submission (ResultStepper.tsx handlePublish).
export function filterPublishedResults(
  results: RaceResultEntry[],
): RaceResultEntry[] {
  return results.filter(
    (r) => !(r.result_status === "classified" && r.finishing_position === null),
  );
}

// ---------------------------------------------------------------------------
// Pure precondition check (exported for unit tests)
// ---------------------------------------------------------------------------

export function checkPublishPreconditions(
  session: { status: string } | null,
  sessionError: boolean,
  league: object | null,
  psRaw: PointsSystem | null,
  // M9 — republish deliberately relaxes the completed-session guard below.
  republish = false,
): PublishResult | null {
  if (sessionError || !session) {
    return { ok: false, status: 404, error: "Session not found" };
  }
  if (session.status === "completed" && !republish) {
    return { ok: false, status: 409, error: "Session already published" };
  }
  if (!league) {
    return { ok: false, status: 404, error: "League not found" };
  }
  if (!psRaw) {
    return { ok: false, status: 422, error: "No points system attached to session" };
  }
  return null; // all clear
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function publishSession(
  input: PublishInput,
): Promise<PublishResult> {
  const db = createSupabaseServiceRoleClient();
  const { sessionId, leagueId, qualifying, results, penalties, actorId, republish } =
    input;

  // 1. Load session + points system + league settings
  const { data: session, error: sessionError } = await db
    .from("race_sessions")
    .select(
      "id, league_id, season_id, status, points_system_id, points_systems(points_by_position, fastest_lap_points, pole_position_points)",
    )
    .eq("id", sessionId)
    .eq("league_id", leagueId)
    .single();

  if (sessionError || !session) {
    return { ok: false, status: 404, error: "Session not found" };
  }
  if (session.status === "completed" && !republish) {
    return { ok: false, status: 409, error: "Session already published" };
  }

  const { data: league } = await db
    .from("leagues")
    .select(
      "fastest_lap_enabled, pole_position_enabled, constructor_championship_enabled, penalty_threshold",
    )
    .eq("id", leagueId)
    .single();

  const psRaw = session.points_systems as unknown as PointsSystem | null;
  const precheck = checkPublishPreconditions(session, false, league ?? null, psRaw, republish);
  if (precheck) return precheck;
  // checkPublishPreconditions guarantees league and psRaw are non-null beyond this point
  const leagueData = league!;
  const ps = psRaw!;

  const resultsCheck = validatePublishResults(results);
  if (resultsCheck) return resultsCheck;

  // Build pole-position lookup from qualifying entries
  const poleDriverId = qualifying.find((q) => q.is_pole)?.driver_id ?? null;

  const sessionPenaltyPtsByDriver = computeSessionPenaltyTotals(penalties);

  // 2. Calculate server-authoritative points_awarded for each result (N2 —
  // filterPublishedResults drops untouched non-participant default rows).
  const resultRows = filterPublishedResults(results).map((r) => ({
    race_session_id: sessionId,
    driver_id: r.driver_id,
    team_id: r.team_id,
    finishing_position: r.finishing_position,
    result_status: r.result_status,
    fastest_lap: r.fastest_lap,
    points_awarded: calculateRacePoints({
      finishing_position: r.finishing_position,
      result_status: r.result_status,
      is_fastest_lap: r.fastest_lap,
      is_pole: r.driver_id === poleDriverId,
      league_fastest_lap_enabled: leagueData.fastest_lap_enabled,
      league_pole_enabled: leagueData.pole_position_enabled,
      points_system: ps,
    }),
    penalty_points: sessionPenaltyPtsByDriver.get(r.driver_id) ?? 0,
    manual_points_adjustment: r.manual_points_adjustment,
    raw_result: r.raw_result,
    notes: r.notes,
  }));

  // 3. Write qualifying results (delete-then-insert per session). An upsert on
  //    (race_session_id, driver_id) cannot survive a position-swap republish:
  //    the table also has unique(race_session_id, qualifying_position), and the
  //    row-by-row upsert transiently collides two drivers on the same position
  //    mid-statement. Clearing the session first removes the collision. F6.
  const { error: qualDeleteErr } = await db
    .from("qualifying_results")
    .delete()
    .eq("race_session_id", sessionId);
  if (qualDeleteErr) {
    return { ok: false, status: 500, error: "Failed to save qualifying results" };
  }
  if (qualifying.length > 0) {
    const { error: qualErr } = await db.from("qualifying_results").insert(
      qualifying.map((q) => ({
        race_session_id: sessionId,
        driver_id: q.driver_id,
        team_id: q.team_id,
        qualifying_position: q.qualifying_position,
        is_pole: q.is_pole,
      })),
    );
    if (qualErr) {
      return { ok: false, status: 500, error: "Failed to save qualifying results" };
    }
  }

  // 4. Write race results (delete-then-insert per session — same reason as
  //    qualifying: unique(race_session_id, finishing_position) makes a
  //    position-swap republish 500 under a row-by-row upsert. F6.
  const { error: resultsDeleteErr } = await db
    .from("race_results")
    .delete()
    .eq("race_session_id", sessionId);
  if (resultsDeleteErr) {
    return { ok: false, status: 500, error: "Failed to save race results" };
  }
  const { error: resultsErr } = await db.from("race_results").insert(resultRows);
  if (resultsErr) {
    return { ok: false, status: 500, error: "Failed to save race results" };
  }

  // 4b. Write reserve assignments (delete-then-insert per session — same
  // idempotency pattern as the upserts above, so a re-publish never
  // duplicates or strands a stale row) — B7.
  const { error: reserveDeleteErr } = await db
    .from("race_reserve_assignments")
    .delete()
    .eq("race_session_id", sessionId);
  if (reserveDeleteErr) {
    return { ok: false, status: 500, error: "Failed to save reserve assignments" };
  }
  const reserveAssignmentRows = buildReserveAssignmentRows(results, sessionId, actorId);
  if (reserveAssignmentRows.length > 0) {
    const { error: reserveInsertErr } = await db
      .from("race_reserve_assignments")
      .insert(reserveAssignmentRows);
    if (reserveInsertErr) {
      return { ok: false, status: 500, error: "Failed to save reserve assignments" };
    }
  }

  // 5. Write penalties (delete-then-insert per session — same idempotency
  // pattern as the reserve assignments above, so a republish never
  // double-counts penalty points into ban thresholds/standings) — X1.
  const { error: penaltyDeleteErr } = await db
    .from("penalties")
    .delete()
    .eq("race_session_id", sessionId);
  if (penaltyDeleteErr) {
    return { ok: false, status: 500, error: "Failed to save penalties" };
  }
  if (penalties.length > 0) {
    const { error: penErr } = await db.from("penalties").insert(
      penalties.map((p) => ({
        league_id: leagueId,
        season_id: session.season_id,
        driver_id: p.driver_id,
        race_session_id: sessionId,
        penalty_points: p.penalty_points,
        reason: p.reason,
        status: p.status,
        steward_notes: p.steward_notes,
        appeal_notes: p.appeal_notes,
        issued_by: actorId,
      })),
    );
    if (penErr) {
      return { ok: false, status: 500, error: "Failed to save penalties" };
    }
  }

  // 6. Recalculate standings (before marking completed so failure is safely retryable)
  // Pass sessionId so this session's already-written results are included even though
  // its status is not yet "completed".
  const recalcResult = await recalculateStandings(
    db,
    leagueId,
    session.season_id,
    leagueData.constructor_championship_enabled,
    leagueData.penalty_threshold,
    sessionId,
  );
  if (!recalcResult.ok) {
    return { ok: false, status: 500, error: recalcResult.error };
  }

  // 7. Mark session as completed (point of no return — standings are already correct)
  const { error: statusErr } = await db
    .from("race_sessions")
    .update({ status: "completed", published_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (statusErr) {
    return { ok: false, status: 500, error: "Failed to mark session as completed" };
  }

  // 8. Audit log — M9: a republish is recorded on the same action, distinct
  // only via metadata.republish, rather than inventing a parallel audit verb.
  await writeAdminAuditLog({
    action: "session.published",
    actorId,
    entityId: sessionId,
    entityType: "race_session",
    metadata: { league_id: leagueId, republish: republish === true, result_count: results.length },
  });

  return { ok: true, sessionId };
}

// ---------------------------------------------------------------------------
// Standings recalculation (full rebuild from all completed sessions)
// ---------------------------------------------------------------------------

// Exported so admin routes that mutate penalty status post-publish (e.g. rescinding
// on appeal) can recompute standings/penalty totals without duplicating this logic.
export async function recalculateStandings(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  leagueId: string,
  seasonId: string,
  constructorEnabled: boolean,
  penaltyThreshold: number,
  additionalSessionId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Fetch all completed race sessions, plus the current one being published
  // (which is not yet marked "completed" when this runs).
  const completedQuery = await db
    .from("race_sessions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId)
    .eq("status", "completed");

  const sessionIds = [
    ...(completedQuery.data?.map((s) => s.id) ?? []),
    ...(additionalSessionId ? [additionalSessionId] : []),
  ];
  // Deduplicate (additionalSessionId may already be completed on a retry)
  const uniqueSessionIds = [...new Set(sessionIds)];

  const { data: allResults } = await db
    .from("race_results")
    .select(
      "driver_id, team_id, finishing_position, result_status, points_awarded, manual_points_adjustment, fastest_lap",
    )
    .in("race_session_id", uniqueSessionIds);

  const { data: adjustments } = await db
    .from("championship_adjustments")
    .select("driver_id, team_id, points_delta")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId);

  // Snapshot previous positions for delta tracking
  const { data: prevDriverStandings } = await db
    .from("driver_standings")
    .select("driver_id, position")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId);

  const prevDriverPositions = new Map(
    (prevDriverStandings ?? []).map((s) => [s.driver_id, s.position]),
  );

  // Track each driver's most recent team across all result rows
  const latestTeamByDriver = new Map<string, string>();
  for (const r of allResults ?? []) {
    if (r.team_id) latestTeamByDriver.set(r.driver_id, r.team_id);
  }

  const newDriverStandings = buildDriverStandings(
    allResults ?? [],
    adjustments ?? [],
    prevDriverPositions,
  );

  // Delete + re-insert to avoid unique position constraint violations
  await db
    .from("driver_standings")
    .delete()
    .eq("league_id", leagueId)
    .eq("season_id", seasonId);

  if (newDriverStandings.length > 0) {
    const { error } = await db.from("driver_standings").insert(
      newDriverStandings.map((s) => ({
        league_id: leagueId,
        season_id: seasonId,
        driver_id: s.driver_id,
        team_id: latestTeamByDriver.get(s.driver_id) ?? null,
        position: s.position,
        previous_position: s.previous_position,
        total_points: s.total_points,
        wins: s.wins,
        podiums: s.podiums,
        fastest_laps: s.fastest_laps,
      })),
    );
    if (error) return { ok: false, error: "Failed to write driver standings" };
  }

  // Constructor standings (only when enabled)
  if (constructorEnabled) {
    const { data: prevTeamStandings } = await db
      .from("team_standings")
      .select("team_id, position")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId);

    const prevTeamPositions = new Map(
      (prevTeamStandings ?? []).map((s) => [s.team_id, s.position]),
    );

    const newTeamStandings = buildTeamStandings(
      allResults ?? [],
      adjustments ?? [],
      prevTeamPositions,
    );

    await db
      .from("team_standings")
      .delete()
      .eq("league_id", leagueId)
      .eq("season_id", seasonId);

    if (newTeamStandings.length > 0) {
      const { error } = await db.from("team_standings").insert(
        newTeamStandings.map((s) => ({
          league_id: leagueId,
          season_id: seasonId,
          team_id: s.team_id,
          position: s.position,
          previous_position: s.previous_position,
          total_points: s.total_points,
          wins: s.wins,
          podiums: s.podiums,
        })),
      );
      if (error) return { ok: false, error: "Failed to write team standings" };
    }
  }

  // Penalty totals — exclude rescinded decisions
  const { data: penaltyRows } = await db
    .from("penalties")
    .select("driver_id, penalty_points")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId)
    .neq("status", "rescinded");

  const { data: entries } = await db
    .from("league_driver_entries")
    .select("driver_id, carry_over_penalty_points")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId);

  const carryOver = new Map(
    (entries ?? []).map((e) => [e.driver_id, e.carry_over_penalty_points]),
  );

  const newPenaltyTotals = buildPenaltyTotals(
    penaltyRows ?? [],
    carryOver,
    penaltyThreshold,
  );

  if (newPenaltyTotals.length > 0) {
    const { error } = await db.from("driver_penalty_totals").upsert(
      newPenaltyTotals.map((t) => ({
        league_id: leagueId,
        season_id: seasonId,
        driver_id: t.driver_id,
        penalty_points: t.penalty_points,
        ban_threshold_reached: t.ban_threshold_reached,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "league_id,season_id,driver_id" },
    );
    if (error) return { ok: false, error: "Failed to write penalty totals" };
  }

  return { ok: true };
}
