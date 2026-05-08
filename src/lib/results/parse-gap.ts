// Workbook result string parser. See HANDOVER §11 for all input formats.
// This module has no server-only dependency so tests can import it directly.

export type ParsedResultStatus = "classified" | "dnf" | "dns" | "dsq" | "ban";

export interface ParsedResult {
  status: ParsedResultStatus;
  rawGap: number | null; // seconds behind leader; null for lapped/retired/dnp
}

export function parseWorkbookGap(raw: string | null | undefined): ParsedResult {
  if (raw === null || raw === undefined || raw.trim() === "") {
    // Blank cell = did not participate / did not start
    return { status: "dns", rawGap: null };
  }

  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();

  if (upper === "BAN") return { status: "ban", rawGap: null };
  if (upper === "DSQ") return { status: "dsq", rawGap: null };
  if (upper.startsWith("DNF")) return { status: "dnf", rawGap: null };

  // "1 Lap - 1", "2 Laps - 2" — lapped but classified per HANDOVER sort order
  if (/^\d+ LAPS? - \d+$/i.test(upper)) {
    return { status: "classified", rawGap: null };
  }

  // Numeric: "0" (leader), "89.354", "93" etc.
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num >= 0) {
    return { status: "classified", rawGap: num };
  }

  return { status: "dnf", rawGap: null };
}
