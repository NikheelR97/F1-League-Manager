export interface ParsedDriver {
  display_name: string;
  racing_number: number | null;
}

// A trailing token is a racing number only if it's 1-3 digits (optionally
// "#"-prefixed) — otherwise it's part of the name (e.g. "Turn 10 Racing").
const TRAILING_NUMBER = /^(.*\S)\s+#?(\d{1,3})$/;

// Parse one pasted roster line: "Name" or "Name <number>" or "Name #<number>".
export function parseRosterLine(line: string): ParsedDriver | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = TRAILING_NUMBER.exec(trimmed);
  if (match) {
    return { display_name: match[1], racing_number: Number(match[2]) };
  }
  return { display_name: trimmed, racing_number: null };
}

// Parse pasted multiline roster text into rows, dropping blank lines.
export function parseRoster(text: string): ParsedDriver[] {
  return text
    .split("\n")
    .map(parseRosterLine)
    .filter((row): row is ParsedDriver => row !== null);
}
