/**
 * Group sessions into rounds (race nights) using leagueRoundNumbers output.
 * Main = lowest race_number (the feature); the rest (sprint) are extras.
 * Groups keep the order in which each round first appears in the input.
 */
export function groupRounds<T extends { id: string; race_number: number | null }>(
  sessions: T[],
  roundNumbers: Map<string, number>,
): { round: number | undefined; main: T; extras: T[] }[] {
  const byRound = new Map<string, T[]>();
  for (const s of sessions) {
    const r = roundNumbers.get(s.id);
    const key = r ? String(r) : s.id; // unscheduled sessions never merge
    byRound.set(key, [...(byRound.get(key) ?? []), s]);
  }
  return [...byRound.values()].map((g) => {
    const sorted = [...g].sort((a, b) => (a.race_number ?? 0) - (b.race_number ?? 0));
    return { round: roundNumbers.get(sorted[0].id), main: sorted[0], extras: sorted.slice(1) };
  });
}
