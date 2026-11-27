const SAST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" });

/**
 * League round number = 1-based index of the session's race night (distinct
 * SAST calendar day of scheduled_at, ascending) within the given sessions.
 * A sprint and feature on the same night share one round. Distinct from
 * circuits.round_number (the circuit's real-world F1 calendar slot).
 */
export function leagueRoundNumbers(
  sessions: { id: string; scheduled_at: string | null }[],
): Map<string, number> {
  const day = (s: { scheduled_at: string | null }) =>
    s.scheduled_at ? SAST_DAY.format(new Date(s.scheduled_at)) : "";
  const days = [...new Set(sessions.map(day))].sort(); // ISO yyyy-mm-dd sorts chronologically
  return new Map(sessions.map((s) => [s.id, days.indexOf(day(s)) + 1]));
}
