/**
 * League round number = 1-based rank of a session by scheduled_at (ascending)
 * within its league/season — distinct from circuits.round_number, which is
 * the circuit's real-world F1 calendar slot and has nothing to do with this
 * league's own race order.
 */
export function leagueRoundNumbers(
  sessions: { id: string; scheduled_at: string | null }[],
): Map<string, number> {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime(),
  );
  return new Map(sorted.map((s, i) => [s.id, i + 1]));
}
