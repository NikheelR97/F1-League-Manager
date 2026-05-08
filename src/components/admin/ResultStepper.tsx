"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  penalty_points: number;
  raw_result: string;
  result_status: ResultStatus;
  team_id: string;
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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  errors: string[];
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

  const positions = classified.map((r) => r.finishing_position!);
  const dupes = positions.filter((p, i) => positions.indexOf(p) !== i);
  if (dupes.length > 0) {
    errors.push(`Duplicate finishing positions: ${[...new Set(dupes)].join(", ")}.`);
  }

  const fastestLapDrivers = rows.filter((r) => r.fastest_lap);
  if (fastestLapDrivers.length > 1) {
    errors.push("Only one driver can have the fastest lap.");
  }

  return { errors, valid: errors.length === 0 };
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
                      className="w-20 border border-f1-border bg-f1-black px-2 py-1 text-sm text-f1-white focus:border-f1-red focus:outline-none"
                      min={1}
                      placeholder="—"
                      type="number"
                      value={row.qualifying_position ?? ""}
                      onChange={(e) =>
                        update(row.driver_id, {
                          qualifying_position: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      checked={row.is_pole}
                      className="accent-f1-red"
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
  rows,
  teams,
  onChange,
}: {
  drivers: SessionDriver[];
  rows: RaceResultRow[];
  teams: LeagueTeam[];
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

  const statuses: ResultStatus[] = ["classified", "dnf", "dns", "dsq", "ban"];

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
              <th className="pb-2 pr-3 w-16">Pos</th>
              <th className="pb-2 pr-3 w-28">Status</th>
              <th className="pb-2 pr-3 w-10 text-center">FL</th>
              <th className="pb-2 pr-3 w-20">Adj pts</th>
              <th className="pb-2 pr-3 w-20">Pen pts</th>
              <th className="pb-2 w-32">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-f1-border">
            {rows.map((row) => {
              const driver = drivers.find((d) => d.driver_id === row.driver_id);
              const currentTeam = teams.find((t) => t.id === row.team_id);
              const isNonClassified = row.result_status !== "classified";
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
                      className="w-full border border-f1-border bg-f1-black px-2 py-1 text-xs text-f1-white focus:border-f1-red focus:outline-none"
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
                    <input
                      className="w-14 border border-f1-border bg-f1-black px-2 py-1 text-sm text-f1-white focus:border-f1-red focus:outline-none disabled:opacity-40"
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
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className="w-full border border-f1-border bg-f1-black px-2 py-1 text-xs text-f1-white focus:border-f1-red focus:outline-none uppercase"
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
                  <td className="py-2 pr-3 text-center">
                    <input
                      checked={row.fastest_lap}
                      className="accent-f1-red"
                      disabled={isNonClassified}
                      type="checkbox"
                      onChange={(e) => setFastestLap(row.driver_id, e.target.checked)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-16 border border-f1-border bg-f1-black px-2 py-1 text-sm text-f1-white focus:border-f1-red focus:outline-none"
                      placeholder="0"
                      type="number"
                      value={row.manual_points_adjustment}
                      onChange={(e) =>
                        update(row.driver_id, { manual_points_adjustment: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-16 border border-f1-border bg-f1-black px-2 py-1 text-sm text-f1-white focus:border-f1-red focus:outline-none"
                      min={0}
                      placeholder="0"
                      type="number"
                      value={row.penalty_points}
                      onChange={(e) =>
                        update(row.driver_id, { penalty_points: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td className="py-2">
                    <input
                      className="w-full border border-f1-border bg-f1-black px-2 py-1 text-xs text-f1-white focus:border-f1-red focus:outline-none"
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
            return (
              <div className="border border-f1-border bg-f1-dark p-4 space-y-3" key={row.id}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-f1-muted">Penalty {i + 1}</span>
                  <button
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
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none"
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
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none"
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
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none"
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
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none"
                      placeholder="Collision at Turn 1"
                      type="text"
                      value={row.reason}
                      onChange={(e) => update(i, { reason: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-f1-muted">Steward notes</label>
                    <textarea
                      className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none resize-none"
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
                        className="w-full border border-f1-border bg-f1-black px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none resize-none"
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
  penalties,
  qualifyingRows,
  results,
  session,
  validation,
}: {
  drivers: SessionDriver[];
  penalties: PenaltyRow[];
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
                const banAlert =
                  row.result_status === "ban" ||
                  (penaltyPtsByDriver.get(row.driver_id) ?? 0) > 0;

                return (
                  <tr key={row.driver_id} className={banAlert ? "bg-destructive/10" : ""}>
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
                        {banAlert && <span className="text-xs text-destructive uppercase">Ban alert</span>}
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
                      {row.penalty_points > 0 ? row.penalty_points : "—"}
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
  session: SessionInfo;
  teams: LeagueTeam[];
}

export function ResultStepper({ drivers, session, teams }: ResultStepperProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const [step, setStep] = useState<Step>("qualifying");
  const [qualifyingRows, setQualifyingRows] = useState<QualifyingRow[]>(() =>
    drivers.map((d) => ({
      driver_id: d.driver_id,
      is_pole: false,
      qualifying_position: null,
      team_id: d.team_id,
    })),
  );
  const [resultRows, setResultRows] = useState<RaceResultRow[]>(() =>
    drivers.map((d) => ({
      driver_id: d.driver_id,
      fastest_lap: false,
      finishing_position: null,
      manual_points_adjustment: 0,
      notes: "",
      penalty_points: 0,
      raw_result: "",
      result_status: "classified" as ResultStatus,
      team_id: d.team_id,
    })),
  );
  const [penaltyRows, setPenaltyRows] = useState<PenaltyRow[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

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
        penalty_points: r.penalty_points,
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
        const body = await res.json().catch(() => ({}));
        setPublishError((body as { error?: string }).error ?? "Failed to publish session.");
        return;
      }

      router.push(`/admin/leagues/${session.league_id}`);
      router.refresh();
    } finally {
      setPublishing(false);
    }
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

      {/* Step content */}
      <div className="border border-f1-border bg-f1-dark p-4 sm:p-6">
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
            rows={resultRows}
            teams={teams}
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
            penalties={penaltyRows}
            qualifyingRows={qualifyingRows}
            results={resultRows}
            session={session}
            validation={validation}
          />
        )}
      </div>

      {publishError && (
        <p className="text-sm text-destructive">{publishError}</p>
      )}

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
