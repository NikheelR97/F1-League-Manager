// Types for parsed workbook data.
// These types are internal to the import pipeline — they must never be sent
// directly to the browser (only sanitised diff summaries go to the client).

export type RaceFormat = "Grand Prix" | "Sprint";

export interface ParsedDriver {
  name: string;               // trimmed display name (exact workbook value)
  currentTeam: string | null; // team at end of season; null = unassigned/reserve
  carryOverPenaltyPoints: number;
  carryOverQualyBans: number;
  carryOverRaceBans: number;
  previousTeam: string | null;        // null = no mid-season transfer
  transferAfterRace: number | null;   // 1-indexed race order in the track list
}

export interface ParsedRace {
  order: number;       // 1-indexed position in the track list
  name: string;        // workbook track name, e.g. "Australia"
  format: RaceFormat;
  circuitSlug: string; // matched slug from CIRCUIT_SLUG_MAP
}

export type ParsedResultStatus = "classified" | "dnf" | "dns" | "dsq" | "ban";

export interface ParsedRaceResult {
  driverName: string;
  qualyException: string | null;          // "BAN" | "DSQ" | null
  gridPosition: number | null;            // null for BAN/DSQ/DNP
  fastestLap: boolean;
  reserveTeam: string | null;             // non-null for reserve drivers
  resultRaw: string;                      // original cell value for audit
  finishingPosition: number | null;
  resultStatus: ParsedResultStatus;
  penaltyPoints: number;
  bans: number;
  manualChampPoints: number;
}

export interface ParsedRaceData {
  race: ParsedRace;
  results: ParsedRaceResult[];
}

export interface ParsedWorkbookDriverStanding {
  pos: number;
  name: string;
  points: number;
  team: string;
}

export interface ParsedWorkbookConstructorStanding {
  pos: number;
  team: string;
  points: number;
}

export interface ParsedWorkbook {
  drivers: ParsedDriver[];
  races: ParsedRace[];
  raceData: ParsedRaceData[];
  workbookDriverStandings: ParsedWorkbookDriverStanding[];
  workbookConstructorStandings: ParsedWorkbookConstructorStanding[];
}
