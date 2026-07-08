// Pure standings calculation — no DB dependency.
// Receives already-fetched rows; the DB service layer calls these after fetching.

export interface ResultForStandings {
  driver_id: string;
  team_id: string;
  finishing_position: number | null;
  result_status: string;
  points_awarded: number;
  manual_points_adjustment: number;
  fastest_lap: boolean;
}

export interface AdjustmentForStandings {
  driver_id: string | null;
  team_id: string | null;
  points_delta: number;
}

export interface DriverStandingResult {
  driver_id: string;
  position: number;
  previous_position: number | null;
  total_points: number;
  wins: number;
  podiums: number;
  fastest_laps: number;
}

export interface TeamStandingResult {
  team_id: string;
  position: number;
  previous_position: number | null;
  total_points: number;
  wins: number;
  podiums: number;
}

export interface PenaltyTotalResult {
  driver_id: string;
  penalty_points: number;
  ban_threshold_reached: boolean;
}

// Tie-break order: total_points → wins → podiums → fastest_laps
export function buildDriverStandings(
  results: ResultForStandings[],
  adjustments: AdjustmentForStandings[],
  previousPositions: Map<string, number>,
): DriverStandingResult[] {
  type Tally = {
    points: number;
    wins: number;
    podiums: number;
    fastest_laps: number;
  };
  const byDriver = new Map<string, Tally>();

  const ensure = (id: string): Tally => {
    if (!byDriver.has(id)) {
      byDriver.set(id, { points: 0, wins: 0, podiums: 0, fastest_laps: 0 });
    }
    return byDriver.get(id)!;
  };

  for (const r of results) {
    const t = ensure(r.driver_id);
    // Championship total = points_awarded + manual_points_adjustment (not penalty_points)
    t.points += r.points_awarded + r.manual_points_adjustment;
    if (r.result_status === "classified" && r.finishing_position === 1) t.wins++;
    if (
      r.result_status === "classified" &&
      r.finishing_position !== null &&
      r.finishing_position <= 3
    )
      t.podiums++;
    if (r.fastest_lap) t.fastest_laps++;
  }

  for (const adj of adjustments) {
    if (adj.driver_id) ensure(adj.driver_id).points += adj.points_delta;
  }

  const sorted = [...byDriver.entries()].sort(([, a], [, b]) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return b.fastest_laps - a.fastest_laps;
  });

  return sorted.map(([driver_id, t], i) => ({
    driver_id,
    position: i + 1,
    previous_position: previousPositions.get(driver_id) ?? null,
    total_points: t.points,
    wins: t.wins,
    podiums: t.podiums,
    fastest_laps: t.fastest_laps,
  }));
}

// Constructor points use only points_awarded (not manual_points_adjustment).
// Tie-break order: total_points → wins → podiums
export function buildTeamStandings(
  results: ResultForStandings[],
  adjustments: AdjustmentForStandings[],
  previousPositions: Map<string, number>,
): TeamStandingResult[] {
  type Tally = { points: number; wins: number; podiums: number };
  const byTeam = new Map<string, Tally>();

  const ensure = (id: string): Tally => {
    if (!byTeam.has(id)) byTeam.set(id, { points: 0, wins: 0, podiums: 0 });
    return byTeam.get(id)!;
  };

  for (const r of results) {
    const t = ensure(r.team_id);
    t.points += r.points_awarded;
    if (r.result_status === "classified" && r.finishing_position === 1) t.wins++;
    if (
      r.result_status === "classified" &&
      r.finishing_position !== null &&
      r.finishing_position <= 3
    )
      t.podiums++;
  }

  for (const adj of adjustments) {
    if (adj.team_id) ensure(adj.team_id).points += adj.points_delta;
  }

  const sorted = [...byTeam.entries()].sort(([, a], [, b]) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.podiums - a.podiums;
  });

  return sorted.map(([team_id, t], i) => ({
    team_id,
    position: i + 1,
    previous_position: previousPositions.get(team_id) ?? null,
    total_points: t.points,
    wins: t.wins,
    podiums: t.podiums,
  }));
}

export function buildPenaltyTotals(
  penaltyRows: Array<{ driver_id: string; penalty_points: number }>,
  carryOverByDriver: Map<string, number>,
  threshold: number,
): PenaltyTotalResult[] {
  const byDriver = new Map<string, number>();

  for (const [driverId, carryOver] of carryOverByDriver) {
    byDriver.set(driverId, (byDriver.get(driverId) ?? 0) + carryOver);
  }

  for (const p of penaltyRows) {
    byDriver.set(p.driver_id, (byDriver.get(p.driver_id) ?? 0) + p.penalty_points);
  }

  return [...byDriver.entries()].map(([driver_id, penalty_points]) => ({
    driver_id,
    penalty_points,
    ban_threshold_reached: penalty_points >= threshold,
  }));
}
