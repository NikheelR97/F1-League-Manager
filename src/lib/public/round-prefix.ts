const STARTS_WITH_ROUND = /^round\b/i;

/**
 * Prefix to prepend before a session/circuit display name, e.g. "Round 3 · ".
 * Returns "" when there's no round number, or when the name already leads
 * with "Round" — avoids "Round 3 · Round 1 — Japan" when a league-authored
 * session name duplicates the word the circuit prefix would add.
 */
export function roundPrefix(
  roundNumber: number | null | undefined,
  displayName: string,
): string {
  if (!roundNumber || STARTS_WITH_ROUND.test(displayName)) return "";
  return `Round ${roundNumber} · `;
}
