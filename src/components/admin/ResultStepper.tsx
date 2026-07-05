"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FormError } from "@/components/ui/FormError";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

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

interface QualifyingRow {
  driver_id: string;
  is_pole: boolean;
  qualifying_position: number | null;
  team_id: string;
}

type ResultStatus = "classified" | "dnf" | "dns" | "dsq" | "ban";

interface RaceResultRow {
  driver_id: string;
  fastest_lap: boolean;
  finishing_position: number | null;
  manual_points_adjustment: number;
  notes: string;
  raw_result: string;
  result_status: ResultStatus;
  team_id: string;
}

// A driver's penalty total prior to this session (from driver_penalty_totals),
// used to project whether this session's formal penalties would cross the
// league's ban threshold. See B2 — the old banAlert ignored this entirely.
export interface ExistingPenaltyTotal {
  driver_id: string;
  penalty_points: number;
}

interface PenaltyRow {
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
  drivers,
  rows,
  onChange,
}: {
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
  drivers,
  qualifyingRows,
  rows,
  teams,
  validation,
  onChange,
}: {
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

  return (
    <div className="space-y-3">
      <p className="text-xs text-f1-muted">
        Enter finishing positions. For reserve drivers, change the team to the one they raced for.
        Non-classified drivers should have no finishing position.
      </p>
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
                    </div>
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
    onChange(rows.filter((_, idx) => idx !== i));
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
        type="button"
        onClick={add}
      >
        + Add Penalty
      </button>
    </div>
  );
}

function ReviewStep({
  drivers,
  existingPenaltyTotals,
  penalties,
  penaltyThreshold,
  qualifyingRows,
  results,
  session,
  validation,
}: {
  drivers: SessionDriver[];
  existingPenaltyTotals: ExistingPenaltyTotal[];
  penalties: PenaltyRow[];
  penaltyThreshold: number | null;
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
                <th className="pb-2 text-right">Total champ</th>
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
                const isBan = row.result_status === "ban";
                const projectedPenaltyTotal =
                  (existingPenaltyTotalByDriver.get(row.driver_id) ?? 0) +
                  (penaltyPtsByDriver.get(row.driver_id) ?? 0);
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
                      {(penaltyPtsByDriver.get(row.driver_id) ?? 0) > 0
                        ? penaltyPtsByDriver.get(row.driver_id)
                        : "—"}
                    </td>
                    <td className="py-2 text-right font-mono font-bold text-f1-white">{champTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
  drivers: SessionDriver[];
  existingPenaltyTotals?: ExistingPenaltyTotal[];
  leagueSlug?: string;
  penaltyThreshold?: number | null;
  session: SessionInfo;
  teams: LeagueTeam[];
}

export function ResultStepper({
  drivers,
  existingPenaltyTotals = [],
  leagueSlug = "",
  penaltyThreshold = null,
  session,
  teams,
}: ResultStepperProps) {
  const csrfToken = useCsrfToken();

  // M1 — Qualifying step's starting grid order (see sortedByRacingNumber).
  const qualifyingDrivers = useMemo(() => sortedByRacingNumber(drivers), [drivers]);

  const [step, setStep] = useState<Step>("qualifying");
  const [qualifyingRows, setQualifyingRows] = useState<QualifyingRow[]>(() =>
    qualifyingDrivers.map(defaultQualifyingRow),
  );
  const [resultRows, setResultRows] = useState<RaceResultRow[]>(() =>
    drivers.map(defaultResultRow),
  );
  const [penaltyRows, setPenaltyRows] = useState<PenaltyRow[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

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
  }, [draftKey, drivers, pristineJson, qualifyingDrivers]);

  // Persist on change. Skipping the pristine state means an untouched (or
  // just-discarded) stepper never writes a draft, so the restore notice only
  // ever appears when there is real work to restore. A quota or privacy-mode
  // failure must never interrupt data entry, so setItem is best-effort.
  useEffect(() => {
    const json = JSON.stringify({ penaltyRows, qualifyingRows, resultRows, step });
    if (json === pristineJson) return;
    try {
      sessionStorage.setItem(draftKey, json);
    } catch {
      // Ignore storage errors (quota exceeded, private browsing, etc.).
    }
  }, [draftKey, penaltyRows, pristineJson, qualifyingRows, resultRows, step]);

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
        // N5(c) — the 422 path can send an object instead of a string; render
        // never gets a non-string into FormError.
        setPublishError(
          typeof rawError === "string"
            ? rawError
            : rawError !== undefined
            ? "Validation failed on the server — check the review step."
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
        role="status"
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
            drivers={drivers}
            rows={qualifyingRows}
            onChange={setQualifyingRows}
          />
        )}
        {step === "results" && (
          <ResultsStep
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
            drivers={drivers}
            existingPenaltyTotals={existingPenaltyTotals}
            penalties={penaltyRows}
            penaltyThreshold={penaltyThreshold}
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
            {publishing ? "Publishing…" : "Publish Results"}
          </button>
        )}
      </div>
    </div>
  );
}
