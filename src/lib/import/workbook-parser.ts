import "server-only";

import ExcelJS from "exceljs";

import { MAX_WORKBOOK_DRIVERS, MAX_WORKBOOK_RACES } from "@/lib/constants";

import type {
  ParsedDriver,
  ParsedRace,
  ParsedRaceData,
  ParsedRaceResult,
  ParsedResultStatus,
  ParsedWorkbook,
  ParsedWorkbookConstructorStanding,
  ParsedWorkbookDriverStanding,
  RaceFormat,
} from "./types";

// ---------------------------------------------------------------------------
// Circuit slug map — workbook track name → official circuit slug
// ---------------------------------------------------------------------------

const CIRCUIT_SLUG_MAP: Record<string, string> = {
  Australia: "albert-park",
  USA: "circuit-of-the-americas",
  Hungary: "hungaroring",
  Austria: "red-bull-ring",
  Spain: "barcelona-catalunya",
  Monaco: "monaco",
  Singapore: "marina-bay",
  Azerbaijan: "baku",
  Bahrain: "bahrain",
  Belgium: "spa-francorchamps",
  "Abu Dhabi": "yas-marina",
  "Saudi Arabia": "jeddah",
  Canada: "circuit-gilles-villeneuve",
  Miami: "miami",
  "Las Vegas": "las-vegas-strip",
  Qatar: "lusail",
  China: "shanghai",
  Mexico: "autodromo-hermanos-rodriguez",
};

// ---------------------------------------------------------------------------
// Sheet layout constants (0-indexed row/col)
// ---------------------------------------------------------------------------

// Final Classifications sheet
const FC_BLOCK_SIZE = 15;
const FC_RACE_NAME_ROW = 4;
const FC_DRIVER_ROW_START = 7;

// Offsets within each 15-column race block (relative to block_start_col)
const OFF_DRIVER = 1;
const OFF_QUALY_EXCEPTION = 2;
const OFF_GRID_START = 3;
const OFF_FASTEST_LAP = 5;
const OFF_RESERVE_TEAM = 6;
const OFF_RESULT = 7;
const OFF_PEN_PTS = 10;
const OFF_BANS = 11;
const OFF_MANUAL_CHAMP_PTS = 13;

// League Management sheet
const LM_DRIVER_ROW_START = 10;
const LM_DRIVER_NAME_COL = 12;
const LM_DRIVER_TEAM_COL = 13;
const LM_CARRY_OVER_PEN_COL = 15;
const LM_CARRY_OVER_QUALY_BANS_COL = 16;
const LM_CARRY_OVER_RACE_BANS_COL = 17;
const LM_PREV_TEAM_COL = 19;
const LM_TRANSFER_RACE_COL = 20;
const LM_TRACK_ROW_START = 13;
const LM_TRACK_ORDER_COL = 7;
const LM_TRACK_NAME_COL = 8;
const LM_TRACK_FORMAT_COL = 9;

// Championships sheet
const CH_DATA_ROW_START = 4;
const CH_CONSTRUCTOR_POS_COL = 1;
const CH_CONSTRUCTOR_TEAM_COL = 4;
const CH_CONSTRUCTOR_PTS_COL = 5;
const CH_DRIVER_POS_COL = 9;
const CH_DRIVER_NAME_COL = 10;
const CH_DRIVER_PTS_COL = 11;
const CH_DRIVER_TEAM_COL = 15;

// ---------------------------------------------------------------------------
// Helpers — all coordinates are 0-indexed; ExcelJS getCell is 1-indexed
// ---------------------------------------------------------------------------

type ScalarValue = string | number | boolean | null;

function cellVal(ws: ExcelJS.Worksheet, r: number, c: number): ScalarValue {
  const v = ws.getCell(r + 1, c + 1).value;
  if (v === null || v === undefined) return null;
  // Formula cell: read the cached result, not the formula string
  if (typeof v === "object" && "result" in v) {
    const result = (v as ExcelJS.CellFormulaValue).result;
    if (result === null || result === undefined) return null;
    if (typeof result === "object") return null; // error result
    return result as ScalarValue;
  }
  if (typeof v === "object") return null; // date, rich-text, hyperlink — not expected
  return v;
}

function str(ws: ExcelJS.Worksheet, r: number, c: number): string {
  const v = cellVal(ws, r, c);
  return v !== null && v !== undefined ? String(v).trim() : "";
}

function num(ws: ExcelJS.Worksheet, r: number, c: number): number {
  const v = cellVal(ws, r, c);
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function parseResultStatus(raw: string): {
  finishingPosition: number | null;
  resultStatus: ParsedResultStatus;
} {
  const s = raw.toUpperCase().trim();
  if (s === "DNF") return { finishingPosition: null, resultStatus: "dnf" };
  if (s === "DNP" || s === "DNS") return { finishingPosition: null, resultStatus: "dns" };
  if (s === "BAN") return { finishingPosition: null, resultStatus: "ban" };
  if (s === "DSQ") return { finishingPosition: null, resultStatus: "dsq" };
  const pos = parseInt(s, 10);
  if (!isNaN(pos) && pos >= 1 && pos <= 20) {
    return { finishingPosition: pos, resultStatus: "classified" };
  }
  return { finishingPosition: null, resultStatus: "dns" };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WorkbookParseError {
  ok: false;
  error: string;
}

export type WorkbookParseResult =
  | { ok: true; data: ParsedWorkbook }
  | WorkbookParseError;

export async function parseWorkbook(data: ArrayBuffer): Promise<WorkbookParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return { ok: false, error: "File could not be parsed as a spreadsheet" };
  }

  const sheetNames = wb.worksheets.map((ws) => ws.name);
  const REQUIRED_SHEETS = ["League Management", "Final Classifications", "Championships"];
  for (const name of REQUIRED_SHEETS) {
    if (!sheetNames.includes(name)) {
      return { ok: false, error: `Required sheet "${name}" is missing` };
    }
  }

  const lm = wb.getWorksheet("League Management")!;
  const fc = wb.getWorksheet("Final Classifications")!;
  const ch = wb.getWorksheet("Championships")!;

  // rowCount / columnCount are 1-indexed counts; subtract 1 to get 0-indexed max
  const fcMaxCol = fc.columnCount - 1;
  const fcMaxRow = fc.rowCount - 1;

  // Guard against pathologically large sheets
  if (fcMaxCol > MAX_WORKBOOK_RACES * FC_BLOCK_SIZE + 20) {
    return { ok: false, error: "Too many columns in Final Classifications sheet" };
  }
  if (fcMaxRow > FC_DRIVER_ROW_START + MAX_WORKBOOK_DRIVERS + 10) {
    return { ok: false, error: "Too many rows in Final Classifications sheet" };
  }

  // -------------------------------------------------------------------------
  // 1. Parse driver list from League Management
  // -------------------------------------------------------------------------
  const drivers: ParsedDriver[] = [];
  for (let r = LM_DRIVER_ROW_START; r <= LM_DRIVER_ROW_START + MAX_WORKBOOK_DRIVERS; r++) {
    const name = str(lm, r, LM_DRIVER_NAME_COL);
    if (!name || name === "-") break;

    const currentTeam = str(lm, r, LM_DRIVER_TEAM_COL) || null;
    const carryOverPenaltyPoints = Math.max(0, Math.floor(num(lm, r, LM_CARRY_OVER_PEN_COL)));
    const qualyBansRaw = str(lm, r, LM_CARRY_OVER_QUALY_BANS_COL);
    const raceBansRaw = str(lm, r, LM_CARRY_OVER_RACE_BANS_COL);
    const carryOverQualyBans = qualyBansRaw && qualyBansRaw !== "-" ? Math.max(0, Math.floor(Number(qualyBansRaw) || 0)) : 0;
    const carryOverRaceBans = raceBansRaw && raceBansRaw !== "-" ? Math.max(0, Math.floor(Number(raceBansRaw) || 0)) : 0;
    const previousTeam = str(lm, r, LM_PREV_TEAM_COL) || null;
    const transferRaw = str(lm, r, LM_TRANSFER_RACE_COL);
    const transferAfterRace = transferRaw && transferRaw !== "-" ? (Math.floor(Number(transferRaw) || 0) || null) : null;

    drivers.push({
      name,
      currentTeam,
      carryOverPenaltyPoints,
      carryOverQualyBans,
      carryOverRaceBans,
      previousTeam,
      transferAfterRace,
    });
  }

  if (drivers.length === 0) {
    return { ok: false, error: "No drivers found in League Management sheet" };
  }

  // -------------------------------------------------------------------------
  // 2. Parse track list from League Management
  // -------------------------------------------------------------------------
  const races: ParsedRace[] = [];
  for (let r = LM_TRACK_ROW_START; r <= LM_TRACK_ROW_START + MAX_WORKBOOK_RACES; r++) {
    const orderRaw = str(lm, r, LM_TRACK_ORDER_COL);
    if (!orderRaw || isNaN(Number(orderRaw))) break;
    const order = Math.floor(Number(orderRaw));
    const name = str(lm, r, LM_TRACK_NAME_COL);
    if (!name) break;
    const formatRaw = str(lm, r, LM_TRACK_FORMAT_COL);
    const format: RaceFormat = formatRaw === "Sprint" ? "Sprint" : "Grand Prix";
    const circuitSlug = CIRCUIT_SLUG_MAP[name];
    if (!circuitSlug) {
      return { ok: false, error: `Unknown track "${name}" — add it to the circuit map` };
    }
    races.push({ order, name, format, circuitSlug });
  }

  if (races.length === 0) {
    return { ok: false, error: "No races found in League Management track list" };
  }

  // -------------------------------------------------------------------------
  // 3. Parse Final Classifications (race results per race block)
  // -------------------------------------------------------------------------
  const raceData: ParsedRaceData[] = [];

  for (let raceIdx = 0; raceIdx < races.length; raceIdx++) {
    const race = races[raceIdx];
    const blockStartCol = 1 + raceIdx * FC_BLOCK_SIZE;
    const sheetRaceName = str(fc, FC_RACE_NAME_ROW, blockStartCol);
    if (!sheetRaceName || sheetRaceName.toLowerCase().includes("inactive")) {
      continue;
    }

    const results: ParsedRaceResult[] = [];

    for (let row = FC_DRIVER_ROW_START; row <= fcMaxRow; row++) {
      const driverName = str(fc, row, blockStartCol + OFF_DRIVER);
      if (!driverName || driverName === "-") break;

      const qualyExceptionRaw = str(fc, row, blockStartCol + OFF_QUALY_EXCEPTION);
      const qualyException = qualyExceptionRaw && qualyExceptionRaw !== "-" ? qualyExceptionRaw.toUpperCase() : null;
      const gridRaw = str(fc, row, blockStartCol + OFF_GRID_START);
      const gridPosition = gridRaw && !isNaN(Number(gridRaw)) ? Math.floor(Number(gridRaw)) : null;
      const fastestLapRaw = cellVal(fc, row, blockStartCol + OFF_FASTEST_LAP);
      const fastestLap = fastestLapRaw !== null && fastestLapRaw !== "" && fastestLapRaw !== 0 && fastestLapRaw !== false;
      const reserveTeam = str(fc, row, blockStartCol + OFF_RESERVE_TEAM) || null;
      const resultRaw = str(fc, row, blockStartCol + OFF_RESULT);
      const penaltyPoints = Math.max(0, Math.floor(num(fc, row, blockStartCol + OFF_PEN_PTS)));
      const bans = Math.max(0, Math.floor(num(fc, row, blockStartCol + OFF_BANS)));
      const manualChampPoints = Math.floor(num(fc, row, blockStartCol + OFF_MANUAL_CHAMP_PTS));

      if (!resultRaw && gridPosition === null) continue;

      const { finishingPosition, resultStatus } = parseResultStatus(resultRaw || "DNP");

      results.push({
        driverName,
        qualyException,
        gridPosition,
        fastestLap,
        reserveTeam,
        resultRaw,
        finishingPosition,
        resultStatus,
        penaltyPoints,
        bans,
        manualChampPoints,
      });
    }

    raceData.push({ race, results });
  }

  if (raceData.length === 0) {
    return { ok: false, error: "No active race data found in Final Classifications" };
  }

  // -------------------------------------------------------------------------
  // 4. Parse Championships standings for diff comparison
  // -------------------------------------------------------------------------
  const workbookConstructorStandings: ParsedWorkbookConstructorStanding[] = [];
  const workbookDriverStandings: ParsedWorkbookDriverStanding[] = [];
  const chMaxRow = ch.rowCount - 1;

  for (let r = CH_DATA_ROW_START; r <= chMaxRow; r++) {
    const consPosRaw = str(ch, r, CH_CONSTRUCTOR_POS_COL);
    const consTeam = str(ch, r, CH_CONSTRUCTOR_TEAM_COL);
    if (consPosRaw && consTeam && consTeam !== "---" && !isNaN(Number(consPosRaw))) {
      workbookConstructorStandings.push({
        pos: Math.floor(Number(consPosRaw)),
        team: consTeam,
        points: Math.floor(num(ch, r, CH_CONSTRUCTOR_PTS_COL)),
      });
    }

    const drvPosRaw = str(ch, r, CH_DRIVER_POS_COL);
    const drvName = str(ch, r, CH_DRIVER_NAME_COL);
    if (drvPosRaw && drvName && drvName !== "-" && !isNaN(Number(drvPosRaw))) {
      workbookDriverStandings.push({
        pos: Math.floor(Number(drvPosRaw)),
        name: drvName,
        points: Math.floor(num(ch, r, CH_DRIVER_PTS_COL)),
        team: str(ch, r, CH_DRIVER_TEAM_COL) || "Reserve",
      });
    }
  }

  return {
    ok: true,
    data: {
      drivers,
      races,
      raceData,
      workbookDriverStandings,
      workbookConstructorStandings,
    },
  };
}
