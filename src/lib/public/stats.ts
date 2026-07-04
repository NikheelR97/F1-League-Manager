export interface ClimberRaceRow {
  race_session_id: string;
  driver_id: string;
  finishing_position: number | null;
  result_status: string;
}

export interface ClimberQualiRow {
  race_session_id: string;
  driver_id: string;
  qualifying_position: number;
}

export interface ClimberResult {
  driverId: string;
  gained: number;
}

// Pairs each classified race result with that driver's qualifying position in
// the same session, then keeps each driver's single best (largest) climb of
// the season. Rows without a matching qualifying record are skipped — there's
// nothing to compare against.
export function computeBiggestClimbers(
  raceRows: ClimberRaceRow[],
  qualiRows: ClimberQualiRow[],
  limit = 5,
): ClimberResult[] {
  const qualiMap = new Map<string, number>();
  for (const q of qualiRows) {
    qualiMap.set(`${q.race_session_id}:${q.driver_id}`, q.qualifying_position);
  }

  const bestByDriver = new Map<string, number>();
  for (const r of raceRows) {
    if (r.result_status !== "classified" || r.finishing_position === null) continue;
    const qualiPosition = qualiMap.get(`${r.race_session_id}:${r.driver_id}`);
    if (qualiPosition === undefined) continue;
    const gained = qualiPosition - r.finishing_position;
    const best = bestByDriver.get(r.driver_id);
    if (best === undefined || gained > best) {
      bestByDriver.set(r.driver_id, gained);
    }
  }

  return [...bestByDriver.entries()]
    .map(([driverId, gained]) => ({ driverId, gained }))
    .filter((c) => c.gained > 0)
    .sort((a, b) => b.gained - a.gained)
    .slice(0, limit);
}
