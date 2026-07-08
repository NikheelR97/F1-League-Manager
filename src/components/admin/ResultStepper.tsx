"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FormError } from "@/components/ui/FormError";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeagueTeam {
  color_hex: string;
  id: string;
  name: string;
}

export interface SessionDriver {
  color_hex: string;
  display_name: string;
  driver_id: string;
  is_reserve?: boolean;
  // M9 correction-mode upgrade — true for a driver unioned in from this
  // session's published data because they've since left the active roster.
  // Their row stays editable; the chip just explains why they're present.
  left_roster?: boolean;
  // M7 — the driver's present-day team, used only to flag when it differs
  // from `team_id` (which is resolved as of the session's own date).
  present_team_id?: string;
  racing_number: number | null;
  team_id: string;
  team_name: string;
}

export interface PointsSystemPreview {
  fastest_lap_points: number;
  points_by_position: Record<string, number>;
  pole_position_points: number;
}

export interface SessionInfo {
  fastest_lap_enabled: boolean;
  id: string;
  league_id: string;
  name: string;
  pole_position_enabled: boolean;
  points_system: PointsSystemPreview;
}

export interface QualifyingRow {
  driver_id: string;
  is_pole: boolean;
  qualifying_position: number | null;
  team_id: string;
}

type ResultStatus = "classified" | "dnf" | "dns" | "dsq" | "ban";

export interface RaceResultRow {
  driver_id: string;
  fastest_lap: boolean;
  finishing_position: number | null;
  manual_points_adjustment: number;
  notes: string;
  raw_result: string;
  result_status: ResultStatus;
  team_id: string;
  // B7 — set only for a reserve driver's row; who they covered for.
  covering_for_driver_id: string | null;
}

// A driver's penalty total prior to this session (from driver_penalty_totals),
// used to project whether this session's formal penalties would cross the
// league's ban threshold. See B2 — the old banAlert ignored this entirely.
export interface ExistingPenaltyTotal {
  driver_id: string;
  penalty_points: number;
}

// M3 — a driver's current season standing, used to preview the championship
// consequence (current -> projected) of publishing this session. `wins` is
// used only as a tie-break for the projected top-3 preview (see ReviewStep).
export interface DriverStandingEntry {
  driver_id: string;
  total_points: number;
  wins: number;
}

// B3 — a driver's most recent recorded ban among this league+season's earlier
// completed sessions, named by which session it happened in (not just "last
// round"), so a ban from two rounds ago or an out-of-order publish still
// surfaces here.
export interface BannedDriverInfo {
  driver_id: string;
  session_name: string;
}

// M9 — a driver's points from this session's most recent publish
// (points_awarded + manual_points_adjustment). Used only in correction mode
// so the Season projection doesn't double-count points this session already
// contributed before the correction.
export interface PreviousSessionPoints {
  driver_id: string;
  points: number;
}

export interface PenaltyRow {
  id: string;
  appeal_notes: string;
  driver_id: string;
  penalty_points: number;
  reason: string;
  status: "open" | "served" | "appealed" | "rescinded";
  steward_notes: string;
}

type Step = "qualifying" | "results" | "penalties" | "review";

const STEPS: Step[] = ["qualifying", "results", "penalties", "review"];
const STEP_LABELS: Record<Step, string> = {
  qualifying: "Qualifying",
  results: "Race Results",
  penalties: "Penalties",
  review: "Review & Publish",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function previewRacePoints(
  row: RaceResultRow,
  qRow: QualifyingRow | undefined,
  ps: PointsSystemPreview,
  fastestLapEnabled: boolean,
  poleEnabled: boolean,
): number {
  if (row.result_status !== "classified" || row.finishing_position === null) return 0;
  const base = ps.points_by_position[String(row.finishing_position)] ?? 0;
  const fl = fastestLapEnabled && row.fastest_lap ? ps.fastest_lap_points : 0;
  const pole = poleEnabled && (qRow?.is_pole ?? false) ? ps.pole_position_points : 0;
  return base + fl + pole;
}

function defaultQualifyingRow(d: SessionDriver): QualifyingRow {
  return { driver_id: d.driver_id, is_pole: false, qualifying_position: null, team_id: d.team_id };
}

function defaultResultRow(d: SessionDriver): RaceResultRow {
  return {
    driver_id: d.driver_id,
    fastest_lap: false,
    finishing_position: null,
    manual_points_adjustment: 0,
    notes: "",
    raw_result: "",
    result_status: "classified",
    team_id: d.team_id,
    covering_for_driver_id: null,
  };
}

// M1 — grid order for the Qualifying step's starting roster. Drivers without
// a racing number (shouldn't normally happen) sort after, keeping their
// existing relative order (Array#sort is a stable sort).
function sortedByRacingNumber(drivers: SessionDriver[]): SessionDriver[] {
  return [...drivers].sort((a, b) => {
    if (a.racing_number === null && b.racing_number === null) return 0;
    if (a.racing_number === null) return 1;
    if (b.racing_number === null) return -1;
    return a.racing_number - b.racing_number;
  });
}

// M1 — Results step row order follows the quali grid entered a step earlier
// instead of roster/join-date order. Drivers with no quali position (DNS,
// etc.) sort after, in their existing order (stable sort).
function orderByQualifying<T extends { driver_id: string }>(
  rows: T[],
  qualifyingRows: QualifyingRow[],
): T[] {
  const posByDriver = new Map(qualifyingRows.map((q) => [q.driver_id, q.qualifying_position]));
  return [...rows].sort((a, b) => {
    const pa = posByDriver.get(a.driver_id) ?? null;
    const pb = posByDriver.get(b.driver_id) ?? null;
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return pa - pb;
  });
}

// ---------------------------------------------------------------------------
// Draft persistence (sessionStorage)
// ---------------------------------------------------------------------------

interface DraftShape {
  penaltyRows: PenaltyRow[];
  qualifyingRows: QualifyingRow[];
  resultRows: RaceResultRow[];
  step: Step;
}

// Pulls the first human-readable message out of a Zod .flatten() object
// (`{ formErrors: string[]; fieldErrors: Record<string, string[]> }`), so the
// publish 422 path can show the real reason instead of a generic guess.
function firstZodMessage(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const { formErrors, fieldErrors } = err as {
    formErrors?: unknown;
    fieldErrors?: unknown;
  };
  if (Array.isArray(formErrors) && typeof formErrors[0] === "string") {
    return formErrors[0];
  }
  if (typeof fieldErrors === "object" && fieldErrors !== null) {
    for (const messages of Object.values(fieldErrors)) {
      if (Array.isArray(messages) && typeof messages[0] === "string") {
        return messages[0];
      }
    }
  }
  return null;
}

function hasDriverId(row: unknown): row is { driver_id: string } {
  return typeof row === "object" && row !== null && typeof (row as { driver_id?: unknown }).driver_id === "string";
}

function isDraftShape(value: unknown): value is DraftShape {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.step === "string" &&
    (STEPS as string[]).includes(v.step) &&
    Array.isArray(v.qualifyingRows) &&
    v.qualifyingRows.every(hasDriverId) &&
    Array.isArray(v.resultRows) &&
    v.resultRows.every(hasDriverId) &&
    Array.isArray(v.penaltyRows) &&
    v.penaltyRows.every(hasDriverId)
  );
}

// Conservative merge: keep saved data for drivers still in the session,
// default rows for drivers that were added since the draft was saved, and
// silently drop rows for drivers that were removed.
function mergeRows<T extends { driver_id: string }>(
  saved: T[],
  drivers: SessionDriver[],
  makeDefault: (d: SessionDriver) => T,
): T[] {
  return drivers.map((d) => saved.find((r) => r.driver_id === d.driver_id) ?? makeDefault(d));
}

function readStoredDraft(key: string): DraftShape | null {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isDraftShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// M2 — offending-row info so the Results step can highlight the specific
// inputs, not just name the position in a Review-step summary.
interface PositionConflict {
  driverIds: string[];
  position: number;
}

interface ValidationResult {
  duplicatePositions: PositionConflict[];
  errors: string[];
  fastestLapDriverIds: string[];
  valid: boolean;
}

function validateResults(rows: RaceResultRow[]): ValidationResult {
  const errors: string[] = [];

  const classified = rows.filter(
    (r) => r.result_status === "classified" && r.finishing_position !== null,
  );

  if (classified.length === 0) {
    errors.push("At least one driver must be classified with a finishing position.");
  }

  const byPosition = new Map<number, string[]>();
  for (const r of classified) {
    const pos = r.finishing_position!;
    byPosition.set(pos, [...(byPosition.get(pos) ?? []), r.driver_id]);
  }
  const duplicatePositions: PositionConflict[] = [...byPosition.entries()]
    .filter(([, driverIds]) => driverIds.length > 1)
    .map(([position, driverIds]) => ({ driverIds, position }));
  if (duplicatePositions.length > 0) {
    errors.push(
      `Duplicate finishing positions: ${duplicatePositions.map((c) => c.position).join(", ")}.`,
    );
  }

  const fastestLapRows = rows.filter((r) => r.fastest_lap);
  const fastestLapDriverIds = fastestLapRows.length > 1 ? fastestLapRows.map((r) => r.driver_id) : [];
  if (fastestLapDriverIds.length > 0) {
    errors.push("Only one driver can have the fastest lap.");
  }

  return { duplicatePositions, errors, fastestLapDriverIds, valid: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function QualifyingStep({
  bannedByDriver,
  drivers,
  rows,
  onChange,
}: {
  bannedByDriver: Map<string, string>;
  drivers: SessionDriver[];
  rows: QualifyingRow[];
  onChange: (rows: QualifyingRow[]) => void;
}) {
  function update(driverId: string, field: Partial<QualifyingRow>) {
    onChange(rows.map((r) => (r.driver_id === driverId ? { ...r, ...field } : r)));
  }

  function setPole(driverId: string) {
    onChange(rows.map((r) => ({ ...r, is_pole: r.driver_id === driverId })));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-f1-muted">
        Enter qualifying positions. Leave blank for drivers who did not qualify (DNS).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border text-left text-xs text-f1-muted">
              <th className="pb-2 pr-4">Driver</th>
              <th className="pb-2 pr-4 w-24">Quali pos</th>
              <th className="pb-2 w-16 text-center">Pole</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-f1-border">
            {rows.map((row) => {
              const driver = drivers.find((d) => d.driver_id === row.driver_id);
              return (
                <tr key={row.driver_id}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-0.5 shrink-0"
                        style={{ backgroundColor: driver?.color_hex ?? "#444" }}
                      />
                      <span className="text-f1-white">{driver?.display_name ?? row.driver_id}</span>
                      {driver?.is_reserve && (
                        <span className="text-xs text-f1-muted uppercase">Reserve</span>
                      )}
                      {driver?.left_roster && (
                        <span className="text-xs text-f1-muted uppercase">Left roster</span>
                      )}
                      {bannedByDriver.has(row.driver_id) && (
                        <span
                          className="text-xs text-destructive uppercase"
                          title={`Recorded ban in ${bannedByDriver.get(row.driver_id)} — verify eligibility before scoring.`}
                        >
                          Banned in {bannedByDriver.get(row.driver_id)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      aria-label={`Qualifying position for ${driver?.display_name ?? row.driver_id}`}
                      className="w-20 border border-f1-border bg-f1-black px-2 py-1 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      min={1}
                      placeholder="—"
                      type="number"
                      value={row.qualifying_position ?? ""}
                      onChange={(e) =>
                        update(row.driver_id, {
                          qualifying_position: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      aria-label={`Pole for ${driver?.display_name ?? row.driver_id}`}
                      checked={row.is_pole}
                      className="accent-f1-red focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      type="checkbox"
                      onChange={() => setPole(row.driver_id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsStep({
  bannedByDriver,
  drivers,
  qualifyingRows,
  rows,
  teams,
  validation,
  onChange,
}: {
  bannedByDriver: Map<string, string>;
  drivers: SessionDriver[];
  qualifyingRows: QualifyingRow[];
  rows: RaceResultRow[];
  teams: LeagueTeam[];
  validation: ValidationResult;
  onChange: (rows: RaceResultRow[]) => void;
}) {
  function update(driverId: string, field: Partial<RaceResultRow>) {
    onChange(rows.map((r) => (r.driver_id === driverId ? { ...r, ...field } : r)));
  }

  function setFastestLap(driverId: string, checked: boolean) {
    if (checked) {
      onChange(rows.map((r) => ({ ...r, fastest_lap: r.driver_id === driverId })));
    } else {
      update(driverId, { fastest_lap: false });
    }
  }

  function driverName(id: string) {
    return drivers.find((d) => d.driver_id === id)?.display_name ?? id;
  }

  const statuses: ResultStatus[] = ["classified", "dnf", "dns", "dsq", "ban"];

  // M1 — display order follows the quali grid entered a step earlier, not
  // roster order. Underlying `rows`/`onChange` stay untouched (still keyed
  // by driver_id) so entered data never jumps.
  const orderedRows = useMemo(
    () => orderByQualifying(rows, qualifyingRows),
    [rows, qualifyingRows],
  );

  const nonReserveDrivers = drivers.filter((d) => !d.is_reserve);

  return (
    <div className="space-y-3">
      <p className="text-xs text-f1-muted">
        Enter finishing positions. Non-classified drivers should have no finishing position.
      </p>
      {drivers.some((d) => d.is_reserve) && (
        <p className="text-xs text-f1-muted">
          Reserve drivers: set Team to the team they raced for — constructor points go to that
          team; the driver keeps their personal points.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border text-left text-xs text-f1-muted">
              <th className="pb-2 pr-3">Driver</th>
              <th className="pb-2 pr-3 w-28">Team</th>
              <th className="pb-2 pr-3 w-28">Status</th>
              <th className="pb-2 pr-3 w-16">Pos</th>
              <th className="pb-2 pr-3 w-10 text-center">FL</th>
              <th className="pb-2 pr-3 w-20">Adj pts</th>
              <th className="pb-2 w-32">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-f1-border">
            {orderedRows.map((row) => {
              const driver = drivers.find((d) => d.driver_id === row.driver_id);
              const currentTeam = teams.find((t) => t.id === row.team_id);
              const isNonClassified = row.result_status !== "classified";
              // M2 — offending rows, highlighted where the data was entered
              // instead of only in the Review-step summary.
              const posConflict = validation.duplicatePositions.find((c) =>
                c.driverIds.includes(row.driver_id),
              );
              const hasFlConflict = validation.fastestLapDriverIds.includes(row.driver_id);
              const posErrorId = `pos-error-${row.driver_id}`;
              const flErrorId = `fl-error-${row.driver_id}`;
              return (
                <tr key={row.driver_id}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-0.5 shrink-0"
                        style={{ backgroundColor: currentTeam?.color_hex ?? driver?.color_hex ?? "#444" }}
                      />
                      <span className="text-f1-white">{driver?.display_name ?? row.driver_id}</span>
                      {driver?.is_reserve && (
                        <span className="text-xs text-f1-muted uppercase">Res</span>
                      )}
                      {driver?.left_roster && (
                        <span className="text-xs text-f1-muted uppercase">Left roster</span>
                      )}
                      {bannedByDriver.has(row.driver_id) && (
                        <span
                          className="text-xs text-destructive uppercase"
                          title={`Recorded ban in ${bannedByDriver.get(row.driver_id)} — verify eligibility before scoring.`}
                        >
                          Banned in {bannedByDriver.get(row.driver_id)}
                        </span>
                      )}
                    </div>
                    {driver?.is_reserve && (
                      <select
                        aria-label={`Covering for ${driverName(row.driver_id)}`}
                        className="mt-1 w-full border border-f1-border bg-f1-black px-2 py-1 text-xs text-f1-muted focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                        value={row.covering_for_driver_id ?? ""}
                        onChange={(e) =>
                          update(row.driver_id, { covering_for_driver_id: e.target.value || null })
                        }
                      >
                        <option value="">Covering for…</option>
                        {nonReserveDrivers.map((d) => (
                          <option key={d.driver_id} value={d.driver_id}>{d.display_name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      aria-label={`Team for ${driverName(row.driver_id)}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1 text-xs text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      value={row.team_id}
                      onChange={(e) => update(row.driver_id, { team_id: e.target.value })}
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                      {!teams.find((t) => t.id === row.team_id) && (
                        <option value={row.team_id}>{driver?.team_name ?? "Unknown"}</option>
                      )}
                    </select>
                    {/* M7 — flags a historical prefill that differs from the driver's
                        present-day team, so it doesn't read as a data-entry mistake. */}
                    {driver?.present_team_id && driver.present_team_id !== row.team_id && (
                      <p className="mt-1 text-xs text-f1-muted">Team as of race date</p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      aria-label={`Status for ${driverName(row.driver_id)}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1 text-xs text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none uppercase"
                      value={row.result_status}
                      onChange={(e) => {
                        const status = e.target.value as ResultStatus;
                        update(row.driver_id, {
                          result_status: status,
                          finishing_position: status !== "classified" ? null : row.finishing_position,
                          fastest_lap: status !== "classified" ? false : row.fastest_lap,
                        });
                      }}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s.toUpperCase()}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      aria-describedby={posConflict ? posErrorId : undefined}
                      aria-invalid={posConflict ? true : undefined}
                      aria-label={`Finishing position for ${driverName(row.driver_id)}`}
                      className={`w-14 border bg-f1-black px-2 py-1 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none disabled:opacity-40 ${
                        posConflict ? "border-destructive" : "border-f1-border"
                      }`}
                      disabled={isNonClassified}
                      min={1}
                      placeholder="—"
                      type="number"
                      value={row.finishing_position ?? ""}
                      onChange={(e) =>
                        update(row.driver_id, {
                          finishing_position: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                    {posConflict && (
                      <p className="mt-1 w-32 text-xs text-destructive" id={posErrorId}>
                        P{posConflict.position} assigned to{" "}
                        {posConflict.driverIds.map((id) => driverName(id)).join(" and ")}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-center">
                    <input
                      aria-describedby={hasFlConflict ? flErrorId : undefined}
                      aria-invalid={hasFlConflict ? true : undefined}
                      aria-label={`Fastest lap for ${driverName(row.driver_id)}`}
                      checked={row.fastest_lap}
                      className={`accent-f1-red focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none ${hasFlConflict ? "outline outline-1 outline-destructive" : ""}`}
                      disabled={isNonClassified}
                      type="checkbox"
                      onChange={(e) => setFastestLap(row.driver_id, e.target.checked)}
                    />
                    {hasFlConflict && (
                      <p className="mt-1 w-24 text-xs text-destructive" id={flErrorId}>
                        Only one fastest lap
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      aria-label={`Points adjustment for ${driverName(row.driver_id)}`}
                      className="w-16 border border-f1-border bg-f1-black px-2 py-1 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      placeholder="0"
                      type="number"
                      value={row.manual_points_adjustment}
                      onChange={(e) =>
                        update(row.driver_id, { manual_points_adjustment: Number(e.target.value) || 0 })
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label={`Notes for ${driverName(row.driver_id)}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1 text-xs text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      placeholder="Optional"
                      type="text"
                      value={row.notes}
                      onChange={(e) => update(row.driver_id, { notes: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PenaltiesStep({
  drivers,
  rows,
  onChange,
}: {
  drivers: SessionDriver[];
  rows: PenaltyRow[];
  onChange: (rows: PenaltyRow[]) => void;
}) {
  // K2 — after removing a row, focus lands on <body> unless we move it
  // somewhere sensible: the row that slid into this slot, else the previous
  // row, else the Add Penalty button (list now empty).
  const removeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<string | "add" | null>(null);

  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;
    if (target === "add") {
      addButtonRef.current?.focus();
    } else {
      removeButtonRefs.current.get(target)?.focus();
    }
  }, [rows.length]);

  function add() {
    onChange([
      ...rows,
      {
        id: crypto.randomUUID(),
        appeal_notes: "",
        driver_id: drivers[0]?.driver_id ?? "",
        penalty_points: 0,
        reason: "",
        status: "open",
        steward_notes: "",
      },
    ]);
  }

  function remove(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    pendingFocusRef.current = next[i]?.id ?? next[i - 1]?.id ?? "add";
    onChange(next);
  }

  function update(i: number, field: Partial<PenaltyRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...field } : r)));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-f1-muted">
        Record formal steward decisions. These create disciplinary penalty records linked to this session.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-f1-muted">No penalties for this session.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => {
            const driver = drivers.find((d) => d.driver_id === row.driver_id);
            const entryLabel = driver?.display_name ?? `entry ${i + 1}`;
            return (
              <div className="border border-f1-border bg-f1-dark p-4 space-y-3" key={row.id}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-f1-muted">Penalty {i + 1}</span>
                  <button
                    aria-label={`Remove penalty for ${entryLabel}`}
                    className="text-xs text-f1-muted hover:text-destructive"
                    ref={(el) => {
                      if (el) removeButtonRefs.current.set(row.id, el);
                      else removeButtonRefs.current.delete(row.id);
                    }}
                    type="button"
                    onClick={() => remove(i)}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-f1-muted">Driver</label>
                    <select
                      aria-label={`Driver for penalty ${entryLabel}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      value={row.driver_id}
                      onChange={(e) => update(i, { driver_id: e.target.value })}
                    >
                      {drivers.map((d) => (
                        <option key={d.driver_id} value={d.driver_id}>
                          {d.display_name}
                        </option>
                      ))}
                    </select>
                    {driver && <p className="text-xs text-f1-muted">{driver.team_name}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-f1-muted">Status</label>
                    <select
                      aria-label={`Status for penalty ${entryLabel}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      value={row.status}
                      onChange={(e) =>
                        update(i, { status: e.target.value as PenaltyRow["status"] })
                      }
                    >
                      <option value="open">Open</option>
                      <option value="served">Served</option>
                      <option value="appealed">Appealed</option>
                      <option value="rescinded">Rescinded</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-f1-muted">Penalty points</label>
                    <input
                      aria-label={`Penalty points for ${entryLabel}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      min={0}
                      type="number"
                      value={row.penalty_points}
                      onChange={(e) =>
                        update(i, { penalty_points: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-f1-muted">Reason</label>
                    <input
                      aria-label={`Reason for penalty ${entryLabel}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none"
                      placeholder="Collision at Turn 1"
                      type="text"
                      value={row.reason}
                      onChange={(e) => update(i, { reason: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-f1-muted">Steward notes</label>
                    <textarea
                      aria-label={`Steward notes for penalty ${entryLabel}`}
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none resize-none"
                      placeholder="Optional steward notes…"
                      rows={2}
                      value={row.steward_notes}
                      onChange={(e) => update(i, { steward_notes: e.target.value })}
                    />
                  </div>
                  {row.status === "appealed" && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs text-f1-muted">Appeal notes</label>
                      <textarea
                        aria-label={`Appeal notes for penalty ${entryLabel}`}
                        className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus-visible:ring-2 focus-visible:ring-f1-red focus-visible:outline-none resize-none"
                        placeholder="Optional appeal notes…"
                        rows={2}
                        value={row.appeal_notes}
                        onChange={(e) => update(i, { appeal_notes: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button
        className="border border-f1-border px-4 py-2 text-xs font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white"
        ref={addButtonRef}
        type="button"
        onClick={add}
      >
        + Add Penalty
      </button>
    </div>
  );
}

function ReviewStep({
  correctionMode,
  driverStandings,
  drivers,
  existingPenaltyTotals,
  penalties,
  penaltyThreshold,
  previousSessionPoints,
  qualifyingRows,
  results,
  session,
  validation,
}: {
  correctionMode: boolean;
  driverStandings: DriverStandingEntry[];
  drivers: SessionDriver[];
  existingPenaltyTotals: ExistingPenaltyTotal[];
  penalties: PenaltyRow[];
  penaltyThreshold: number | null;
  previousSessionPoints: PreviousSessionPoints[];
  qualifyingRows: QualifyingRow[];
  results: RaceResultRow[];
  session: SessionInfo;
  validation: ValidationResult;
}) {
  const classified = results
    .filter((r) => r.result_status === "classified" && r.finishing_position !== null)
    .sort((a, b) => (a.finishing_position ?? 99) - (b.finishing_position ?? 99));
  const nonClassified = results.filter(
    (r) => r.result_status !== "classified" || r.finishing_position === null,
  );
  const ordered = [...classified, ...nonClassified];

  const penaltyPtsByDriver = new Map<string, number>();
  for (const p of penalties) {
    if (p.status !== "rescinded") {
      penaltyPtsByDriver.set(p.driver_id, (penaltyPtsByDriver.get(p.driver_id) ?? 0) + p.penalty_points);
    }
  }

  const existingPenaltyTotalByDriver = new Map(
    existingPenaltyTotals.map((t) => [t.driver_id, t.penalty_points]),
  );

  // M3 — championship consequence preview: current season total, plus this
  // session's previewed points. In correction mode the current total already
  // includes this session's *previous* publish, so that amount is subtracted
  // first to avoid double-counting it.
  const standingsByDriver = new Map(driverStandings.map((s) => [s.driver_id, s.total_points]));
  const winsByDriver = new Map(driverStandings.map((s) => [s.driver_id, s.wins]));
  const previousSessionPointsByDriver = new Map(
    previousSessionPoints.map((p) => [p.driver_id, p.points]),
  );
  const projectedByDriver = new Map<string, number>();
  const projectedWinsByDriver = new Map<string, number>();
  const allProjectedDriverIds = new Set([
    ...standingsByDriver.keys(),
    ...results.map((r) => r.driver_id),
  ]);
  for (const driverId of allProjectedDriverIds) {
    const row = results.find((r) => r.driver_id === driverId);
    const qRow = qualifyingRows.find((q) => q.driver_id === driverId);
    const sessionPts = row
      ? previewRacePoints(
          row,
          qRow,
          session.points_system,
          session.fastest_lap_enabled,
          session.pole_position_enabled,
        ) + row.manual_points_adjustment
      : 0;
    const previousPts = correctionMode ? (previousSessionPointsByDriver.get(driverId) ?? 0) : 0;
    projectedByDriver.set(driverId, (standingsByDriver.get(driverId) ?? 0) - previousPts + sessionPts);
    // Cheap tie-break level: this session's previewed P1 counts as a win.
    // ponytail: only a wins tie-break — full F1 countback (2nds, 3rds, ...)
    // stays server-side in buildDriverStandings.
    const winThisSession = row?.result_status === "classified" && row.finishing_position === 1 ? 1 : 0;
    projectedWinsByDriver.set(driverId, (winsByDriver.get(driverId) ?? 0) + winThisSession);
  }
  const sortedProjected = [...projectedByDriver.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (projectedWinsByDriver.get(b[0]) ?? 0) - (projectedWinsByDriver.get(a[0]) ?? 0);
  });
  const projectedTop3 = sortedProjected
    .slice(0, 3)
    .reduce<{ lines: string[]; rank: number }>(
      (acc, [driverId, total], i) => {
        const wins = projectedWinsByDriver.get(driverId) ?? 0;
        const prev = sortedProjected[i - 1];
        const next = sortedProjected[i + 1];
        const tiedWithPrev =
          !!prev && prev[1] === total && (projectedWinsByDriver.get(prev[0]) ?? 0) === wins;
        const tiedWithNext =
          !!next && next[1] === total && (projectedWinsByDriver.get(next[0]) ?? 0) === wins;
        const rank = tiedWithPrev ? acc.rank : i + 1;
        const driver = drivers.find((d) => d.driver_id === driverId);
        const prefix = tiedWithPrev || tiedWithNext ? "=" : "";
        acc.lines.push(`${prefix}${rank}. ${driver?.display_name ?? driverId} ${total}`);
        acc.rank = rank;
        return acc;
      },
      { lines: [], rank: 0 },
    ).lines.join(" · ");

  return (
    <div className="space-y-6">
      {/* Validation errors — must be clear before publish */}
      {!validation.valid && (
        <div className="border border-destructive bg-destructive/10 p-4 space-y-1">
          <p className="text-xs font-bold uppercase text-destructive">
            Fix the following before publishing:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {validation.errors.map((e) => (
              <li className="text-sm text-destructive" key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Finish order */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase text-f1-muted">Finish Order</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs text-f1-muted">
                <th className="pb-2 pr-4">Pos</th>
                <th className="pb-2 pr-4">Driver</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-3 text-right">Race pts</th>
                <th className="pb-2 pr-3 text-right">Adj</th>
                <th className="pb-2 pr-3 text-right">Pen pts</th>
                <th className="pb-2 pr-3 text-right">Total champ</th>
                <th className="pb-2 text-right">Season</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-f1-border">
              {ordered.map((row) => {
                const driver = drivers.find((d) => d.driver_id === row.driver_id);
                const qRow = qualifyingRows.find((q) => q.driver_id === row.driver_id);
                const racePts = previewRacePoints(
                  row,
                  qRow,
                  session.points_system,
                  session.fastest_lap_enabled,
                  session.pole_position_enabled,
                );
                const champTotal = racePts + row.manual_points_adjustment;
                const currentSeasonTotal = standingsByDriver.get(row.driver_id) ?? 0;
                const projectedSeasonTotal = projectedByDriver.get(row.driver_id) ?? currentSeasonTotal;
                const isBan = row.result_status === "ban";
                const penPts = penaltyPtsByDriver.get(row.driver_id) ?? 0;
                const projectedPenaltyTotal =
                  (existingPenaltyTotalByDriver.get(row.driver_id) ?? 0) + penPts;
                const isThresholdAlert =
                  !isBan && penaltyThreshold != null && projectedPenaltyTotal >= penaltyThreshold;

                return (
                  <tr key={row.driver_id} className={isBan || isThresholdAlert ? "bg-destructive/10" : ""}>
                    <td className="py-2 pr-4 font-mono text-f1-muted">
                      {row.finishing_position ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-0.5 shrink-0"
                          style={{ backgroundColor: driver?.color_hex ?? "#444" }}
                        />
                        <span className="text-f1-white">{driver?.display_name ?? row.driver_id}</span>
                        {row.fastest_lap && <span className="text-xs text-purple-400">FL</span>}
                        {qRow?.is_pole && <span className="text-xs text-yellow-400">PP</span>}
                        {isBan && <span className="text-xs text-destructive uppercase">Ban</span>}
                        {isThresholdAlert && (
                          <span
                            className="text-xs text-destructive uppercase"
                            title="Alert only — admin decision required"
                          >
                            Threshold alert
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`text-xs font-bold uppercase ${
                          row.result_status === "classified" ? "text-f1-muted" : "text-destructive"
                        }`}
                      >
                        {row.result_status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-f1-white">{racePts}</td>
                    <td className="py-2 pr-3 text-right font-mono text-f1-muted">
                      {row.manual_points_adjustment !== 0
                        ? (row.manual_points_adjustment > 0 ? "+" : "") + row.manual_points_adjustment
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-f1-muted">
                      {penPts > 0 ? penPts : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono font-bold text-f1-white">{champTotal}</td>
                    <td className="py-2 text-right font-mono text-f1-muted">
                      <span>{currentSeasonTotal}</span> <span aria-hidden="true">&rarr;</span>{" "}
                      <span className="text-f1-white">{projectedSeasonTotal}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {projectedTop3 && (
          <p className="mt-2 text-xs text-f1-muted">Projected: {projectedTop3}</p>
        )}
      </section>

      {/* Formal penalties */}
      {penalties.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase text-f1-muted">Formal Penalties</h3>
          <ul className="space-y-2">
            {penalties.map((p, i) => {
              const driver = drivers.find((d) => d.driver_id === p.driver_id);
              return (
                <li key={i} className="border border-f1-border bg-f1-dark p-3 text-sm">
                  <p className="font-bold text-f1-white">
                    {driver?.display_name ?? p.driver_id}
                    <span className="ml-2 font-normal text-destructive">{p.penalty_points} pts</span>
                    <span className="ml-2 font-mono text-xs text-f1-muted uppercase">{p.status}</span>
                  </p>
                  <p className="text-f1-muted">{p.reason}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Standings impact */}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase text-f1-muted">Standings Impact</h3>
        <p className="text-sm text-f1-muted">
          Driver and constructor standings will be fully recalculated from all completed sessions
          immediately after publish. Penalty totals will also update.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main stepper
// ---------------------------------------------------------------------------

interface ResultStepperProps {
  // B3 — each driver's most recent recorded ban among this league+season's
  // earlier completed sessions (badge only, never a blocker on entry).
  bannedDrivers?: BannedDriverInfo[];
  // M9 — true when correcting an already-published session. Prefills from
  // published data (initial*Rows below) instead of blank rows, bypasses the
  // sessionStorage draft entirely, and republishes rather than blocking.
  correctionMode?: boolean;
  // M3 — current season standings, used to preview the championship
  // consequence of publishing on the Review step.
  driverStandings?: DriverStandingEntry[];
  drivers: SessionDriver[];
  existingPenaltyTotals?: ExistingPenaltyTotal[];
  initialPenaltyRows?: PenaltyRow[];
  initialQualifyingRows?: QualifyingRow[];
  initialResultRows?: RaceResultRow[];
  leagueSlug?: string;
  penaltyThreshold?: number | null;
  // M9/M3 — this session's previously-published per-driver points, used only
  // in correction mode to avoid double-counting in the Season projection.
  previousSessionPoints?: PreviousSessionPoints[];
  session: SessionInfo;
  teams: LeagueTeam[];
}

export function ResultStepper({
  bannedDrivers = [],
  correctionMode = false,
  driverStandings = [],
  drivers,
  existingPenaltyTotals = [],
  initialPenaltyRows,
  initialQualifyingRows,
  initialResultRows,
  leagueSlug = "",
  penaltyThreshold = null,
  previousSessionPoints = [],
  session,
  teams,
}: ResultStepperProps) {
  const csrfToken = useCsrfToken();

  // B3 — driver_id -> the session name of their most recent recorded ban.
  const bannedByDriver = useMemo(
    () => new Map(bannedDrivers.map((b) => [b.driver_id, b.session_name])),
    [bannedDrivers],
  );

  // M1 — Qualifying step's starting grid order (see sortedByRacingNumber).
  const qualifyingDrivers = useMemo(() => sortedByRacingNumber(drivers), [drivers]);

  const [step, setStep] = useState<Step>("qualifying");
  const [qualifyingRows, setQualifyingRows] = useState<QualifyingRow[]>(() =>
    initialQualifyingRows
      ? mergeRows(initialQualifyingRows, qualifyingDrivers, defaultQualifyingRow)
      : qualifyingDrivers.map(defaultQualifyingRow),
  );
  const [resultRows, setResultRows] = useState<RaceResultRow[]>(() =>
    initialResultRows
      ? mergeRows(initialResultRows, drivers, defaultResultRow)
      : drivers.map(defaultResultRow),
  );
  const [penaltyRows, setPenaltyRows] = useState<PenaltyRow[]>(() => initialPenaltyRows ?? []);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // K1 — the success banner replaces the whole stepper subtree; without this
  // focus would fall back to <body> instead of landing on the banner.
  const publishSuccessRef = useFocusOnMount<HTMLDivElement>(publishSuccess);

  const draftKey = `result-stepper-draft:${session.id}`;
  const draftRef = useRef<DraftShape | "pending" | null>("pending");

  // Serialized untouched state — used to avoid persisting (or announcing) a
  // draft the admin never actually typed into.
  const pristineJson = useMemo(
    () =>
      JSON.stringify({
        penaltyRows: [],
        qualifyingRows: qualifyingDrivers.map(defaultQualifyingRow),
        resultRows: drivers.map(defaultResultRow),
        step: "qualifying",
      }),
    [drivers, qualifyingDrivers],
  );

  // Restore a saved draft after mount only — reading sessionStorage during
  // the initial render (e.g. in a useState initializer) would produce a
  // client/server markup mismatch since this component is server-rendered.
  useEffect(() => {
    // M9 — published data must win over a stale draft; correction mode never
    // reads (or writes, below) the sessionStorage draft for this session.
    if (correctionMode) return;
    if (draftRef.current !== "pending") return;
    draftRef.current = readStoredDraft(draftKey);

    const draft = draftRef.current;
    if (draft === null) return;
    // A draft identical to untouched state carries no work — skip the notice.
    if (JSON.stringify(draft) === pristineJson) return;

    setStep(draft.step);
    setQualifyingRows(mergeRows(draft.qualifyingRows, qualifyingDrivers, defaultQualifyingRow));
    setResultRows(mergeRows(draft.resultRows, drivers, defaultResultRow));
    setPenaltyRows(draft.penaltyRows.filter((p) => drivers.some((d) => d.driver_id === p.driver_id)));
    setDraftRestored(true);
  }, [correctionMode, draftKey, drivers, pristineJson, qualifyingDrivers]);

  // Persist on change. Skipping the pristine state means an untouched (or
  // just-discarded) stepper never writes a draft, so the restore notice only
  // ever appears when there is real work to restore. A quota or privacy-mode
  // failure must never interrupt data entry, so setItem is best-effort.
  useEffect(() => {
    if (correctionMode) return;
    const json = JSON.stringify({ penaltyRows, qualifyingRows, resultRows, step });
    if (json === pristineJson) return;
    try {
      sessionStorage.setItem(draftKey, json);
    } catch {
      // Ignore storage errors (quota exceeded, private browsing, etc.).
    }
  }, [correctionMode, draftKey, penaltyRows, pristineJson, qualifyingRows, resultRows, step]);

  function discardDraft() {
    if (
      !confirm(
        "Discard the entire draft? All entered qualifying, race, and penalty data will be lost.",
      )
    ) {
      return;
    }
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // Ignore storage errors.
    }
    setStep("qualifying");
    setQualifyingRows(qualifyingDrivers.map(defaultQualifyingRow));
    setResultRows(drivers.map(defaultResultRow));
    setPenaltyRows([]);
    setDraftRestored(false);
  }

  const stepIdx = STEPS.indexOf(step);
  const validation = validateResults(resultRows);

  function prevStep() {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
  }

  function nextStep() {
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]);
  }

  async function handlePublish() {
    if (!validation.valid) return;
    if (
      correctionMode &&
      !confirm(
        "Republish corrected results? This replaces the current public result and recalculates standings.",
      )
    ) {
      return;
    }

    setPublishError(null);
    setPublishing(true);
    try {
      const qualifying = qualifyingRows
        .filter((q) => q.qualifying_position !== null)
        .map((q) => ({
          driver_id: q.driver_id,
          is_pole: q.is_pole,
          qualifying_position: q.qualifying_position!,
          team_id: q.team_id,
        }));

      const results = resultRows.map((r) => ({
        driver_id: r.driver_id,
        fastest_lap: r.fastest_lap,
        finishing_position: r.finishing_position,
        manual_points_adjustment: r.manual_points_adjustment,
        notes: r.notes || null,
        raw_result: r.raw_result || null,
        result_status: r.result_status,
        team_id: r.team_id,
        // Restored drafts saved before this field existed won't have it.
        covering_for_driver_id: r.covering_for_driver_id ?? null,
      }));

      const penalties = penaltyRows
        .filter((p) => p.driver_id && p.reason)
        .map((p) => ({
          appeal_notes: p.appeal_notes || null,
          driver_id: p.driver_id,
          penalty_points: p.penalty_points,
          reason: p.reason,
          status: p.status,
          steward_notes: p.steward_notes || null,
        }));

      const res = await fetch(`/api/admin/sessions/${session.id}/publish`, {
        body: JSON.stringify({
          league_id: session.league_id,
          penalties,
          qualifying,
          republish: correctionMode,
          results,
        }),
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      });

      if (!res.ok) {
        const body: unknown = await res.json().catch(() => ({}));
        const rawError = (body as { error?: unknown }).error;
        // N5(c) — the 422 path can send a Zod flatten() object instead of a
        // string; pull out the actual field-level reason so FormError never
        // renders a non-string (and never a made-up "review step" guess).
        setPublishError(
          typeof rawError === "string"
            ? rawError
            : rawError !== undefined
              ? (firstZodMessage(rawError) ??
                "Couldn't publish — please review your entries.")
              : "Failed to publish session.",
        );
        return;
      }

      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        // Ignore storage errors.
      }

      // P1 — stay put and show a success banner instead of an unannounced
      // redirect; the banner links out to the public result and back to the
      // league admin page.
      setPublishSuccess(true);
    } finally {
      setPublishing(false);
    }
  }

  if (publishSuccess) {
    return (
      <div
        className="space-y-3 border border-green-700 bg-green-900/10 p-6"
        ref={publishSuccessRef}
        role="status"
        tabIndex={-1}
      >
        <p className="text-sm font-bold text-green-400">Results published.</p>
        <div className="flex gap-4 text-xs font-bold uppercase">
          {leagueSlug && (
            <Link
              className="text-f1-white underline hover:text-f1-red"
              href={`/leagues/${leagueSlug}/results/${session.id}`}
            >
              View public result
            </Link>
          )}
          <Link
            className="text-f1-white underline hover:text-f1-red"
            href={`/admin/leagues/${session.league_id}`}
          >
            Back to league
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav aria-label="Progress" className="flex gap-0">
        {STEPS.map((s, i) => (
          <div
            className={`flex-1 border-b-2 pb-2 text-center text-xs font-bold uppercase transition-colors ${
              s === step
                ? "border-f1-red text-f1-white"
                : i < stepIdx
                ? "border-f1-border text-f1-muted"
                : "border-f1-border text-f1-muted opacity-40"
            }`}
            key={s}
          >
            {STEP_LABELS[s]}
          </div>
        ))}
      </nav>

      {/* M20a — announce step changes to screen readers; the visual nav above
          gives no other signal that the panel below has changed. */}
      <div aria-live="polite" className="sr-only">
        {`Step ${stepIdx + 1} of ${STEPS.length}: ${STEP_LABELS[step]}`}
      </div>

      {/* M9 — correction-mode warning, shown on every step (not just Review) */}
      {correctionMode && (
        <div className="border border-yellow-700 bg-yellow-900/10 px-4 py-3 text-sm text-yellow-400">
          <span className="font-bold uppercase">Editing published results</span> — publishing
          again replaces the current public result and recalculates standings.
        </div>
      )}

      {/* Draft restored notice */}
      {draftRestored && (
        <div className="flex items-center justify-between gap-4 border border-f1-border bg-f1-dark px-4 py-2 text-xs text-f1-muted">
          <span>Draft restored from this browser session.</span>
          <button
            className="font-bold uppercase text-f1-muted transition-colors hover:text-f1-white"
            type="button"
            onClick={discardDraft}
          >
            Discard draft
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="border border-f1-border bg-f1-dark p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase text-f1-white">{STEP_LABELS[step]}</h2>
        {step === "qualifying" && (
          <QualifyingStep
            bannedByDriver={bannedByDriver}
            drivers={drivers}
            rows={qualifyingRows}
            onChange={setQualifyingRows}
          />
        )}
        {step === "results" && (
          <ResultsStep
            bannedByDriver={bannedByDriver}
            drivers={drivers}
            qualifyingRows={qualifyingRows}
            rows={resultRows}
            teams={teams}
            validation={validation}
            onChange={setResultRows}
          />
        )}
        {step === "penalties" && (
          <PenaltiesStep
            drivers={drivers}
            rows={penaltyRows}
            onChange={setPenaltyRows}
          />
        )}
        {step === "review" && (
          <ReviewStep
            correctionMode={correctionMode}
            driverStandings={driverStandings}
            drivers={drivers}
            existingPenaltyTotals={existingPenaltyTotals}
            penalties={penaltyRows}
            penaltyThreshold={penaltyThreshold}
            previousSessionPoints={previousSessionPoints}
            qualifyingRows={qualifyingRows}
            results={resultRows}
            session={session}
            validation={validation}
          />
        )}
      </div>

      <FormError message={publishError} />

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          className="border border-f1-border px-4 py-2 text-sm font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white disabled:opacity-30"
          disabled={stepIdx === 0}
          type="button"
          onClick={prevStep}
        >
          Back
        </button>
        {step !== "review" ? (
          <button
            className="border border-f1-red bg-f1-red px-6 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
            type="button"
            onClick={nextStep}
          >
            Next: {STEP_LABELS[STEPS[stepIdx + 1]]}
          </button>
        ) : (
          <button
            className="border border-f1-red bg-f1-red px-6 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
            disabled={publishing || !validation.valid}
            title={!validation.valid ? "Fix validation errors before publishing" : undefined}
            type="button"
            onClick={handlePublish}
          >
            {publishing
              ? "Publishing…"
              : correctionMode
              ? "Republish corrected results"
              : "Publish Results"}
          </button>
        )}
      </div>
    </div>
  );
}
