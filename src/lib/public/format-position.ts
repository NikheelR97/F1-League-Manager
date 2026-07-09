// N2 — a classified result can still carry a null finishing_position (e.g. a
// reserve/free-agent who wasn't entered in the session but got a default
// "classified" row on publish). Rendering `P${finishing_position}` directly
// for those rows printed the literal string "Pnull". This centralizes the
// guard so every result-position render (team page, driver page, ...) shows
// "—" instead, matching how the public race report already handles it.
export function formatPosition(
  resultStatus: string,
  finishingPosition: number | null,
): string {
  if (resultStatus !== "classified") return resultStatus.toUpperCase();
  if (finishingPosition === null) return "—";
  return `P${finishingPosition}`;
}
