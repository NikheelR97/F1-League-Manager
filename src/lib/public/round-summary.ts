import { leagueRoundNumbers } from "@/lib/public/league-round-number";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type SummarySession = {
  id: string;
  name: string;
  scheduled_at: string | null;
  race_number: number | null;
  circuit: string | null;
};
export type SummaryResult = {
  race_session_id: string;
  driver_id: string;
  team_id: string;
  finishing_position: number | null;
  points_awarded: number;
  manual_points_adjustment: number;
  driver_name: string;
};
export type StandingRow = {
  id: string;
  position: number;
  previous_position: number | null;
  name: string;
};
export type Mover = { name: string; delta: number };
export type RoundSummary = {
  roundNumber: number;
  roundName: string;
  podium: { position: number; driverName: string; points: number }[];
  driverRoundPoints: Map<string, number>;
  teamRoundPoints: Map<string, number>;
  movers: { up: Mover[]; down: Mover[] };
};
export type NextSession = { circuit: string | null; scheduled_at: string };

/** What changed in the latest round (all completed sessions on its SAST race night). */
export function buildRoundSummary(
  completed: SummarySession[],
  results: SummaryResult[],
  drivers: StandingRow[],
): RoundSummary | null {
  if (completed.length === 0) return null;
  const rounds = leagueRoundNumbers(completed);
  const roundNumber = Math.max(...rounds.values());
  const inRound = completed.filter((s) => rounds.get(s.id) === roundNumber);
  // Feature race = lowest race_number (sprint is 2).
  const feature = [...inRound].sort((a, b) => (a.race_number ?? 1) - (b.race_number ?? 1))[0];
  const ids = new Set(inRound.map((s) => s.id));

  const driverRoundPoints = new Map<string, number>();
  const teamRoundPoints = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const r of results) {
    if (!ids.has(r.race_session_id)) continue;
    const pts = r.points_awarded + r.manual_points_adjustment;
    add(driverRoundPoints, r.driver_id, pts);
    add(teamRoundPoints, r.team_id, pts);
  }

  const podium = results
    .filter((r) => r.race_session_id === feature.id && r.finishing_position && r.finishing_position <= 3)
    .sort((a, b) => a.finishing_position! - b.finishing_position!)
    .map((r) => ({
      driverName: r.driver_name,
      points: r.points_awarded + r.manual_points_adjustment,
      position: r.finishing_position!,
    }));

  const moved = drivers
    .filter((d) => d.previous_position != null && d.previous_position !== d.position)
    .map((d) => ({ delta: d.previous_position! - d.position, name: d.name }));
  const up = moved.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const down = moved.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

  return {
    driverRoundPoints,
    movers: { down, up },
    podium,
    roundName: feature.name,
    roundNumber,
    teamRoundPoints,
  };
}

type Circuit = { name: string } | null;

export async function loadRoundSummary(
  leagueId: string,
  seasonId: string,
): Promise<{ summary: RoundSummary | null; nextSession: NextSession | null }> {
  const db = createSupabaseServiceRoleClient();
  const [{ data: sessions }, { data: standings }, { data: next }] = await Promise.all([
    db
      .from("race_sessions")
      .select("id, name, scheduled_at, race_number, circuits(name)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("status", "completed")
      .limit(500),
    db
      .from("driver_standings")
      .select("position, previous_position, drivers(id, display_name)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position")
      .limit(100),
    db
      .from("race_sessions")
      .select("scheduled_at, circuits(name)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("status", "scheduled")
      .order("scheduled_at")
      .limit(1)
      .maybeSingle(),
  ]);

  const completed: SummarySession[] = (sessions ?? []).map((s) => ({
    circuit: (s.circuits as unknown as Circuit)?.name ?? null,
    id: s.id,
    name: s.name,
    race_number: s.race_number,
    scheduled_at: s.scheduled_at,
  }));

  // Only the latest race night's results are needed.
  const rounds = leagueRoundNumbers(completed);
  const last = Math.max(0, ...rounds.values());
  const lastIds = completed.filter((s) => rounds.get(s.id) === last).map((s) => s.id);
  const { data: rows } = lastIds.length
    ? await db
        .from("race_results")
        .select(
          "race_session_id, driver_id, team_id, finishing_position, points_awarded, manual_points_adjustment, drivers(display_name)",
        )
        .in("race_session_id", lastIds)
    : { data: [] };

  const results: SummaryResult[] = (rows ?? []).map((r) => ({
    ...r,
    driver_name: (r.drivers as unknown as { display_name: string } | null)?.display_name ?? "TBD",
  }));
  const drivers: StandingRow[] = (standings ?? []).map((d) => {
    const drv = d.drivers as unknown as { id: string; display_name: string } | null;
    return {
      id: drv?.id ?? "",
      name: drv?.display_name ?? "TBD",
      position: d.position,
      previous_position: d.previous_position,
    };
  });

  return {
    nextSession: next?.scheduled_at
      ? { circuit: (next.circuits as unknown as Circuit)?.name ?? null, scheduled_at: next.scheduled_at }
      : null,
    summary: buildRoundSummary(completed, results, drivers),
  };
}
