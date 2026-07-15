"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { parseRoster } from "@/lib/drivers/parse-roster";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface Team {
  id: string;
  name: string;
}

interface AddDriversGridProps {
  leagueId: string;
  teams: Team[];
}

interface Row {
  display_name: string;
  is_reserve: boolean;
  racing_number: string;
  team_id: string;
}

function emptyRow(): Row {
  return { display_name: "", is_reserve: false, racing_number: "", team_id: "" };
}

export function AddDriversGrid({ leagueId, teams }: AddDriversGridProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 5 }, emptyRow));
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function duplicateLastRow() {
    setRows((prev) => (prev.length === 0 ? prev : [...prev, { ...prev[prev.length - 1] }]));
  }

  function addPastedRoster() {
    const parsed = parseRoster(pasteText);
    if (parsed.length === 0) return;
    setRows((prev) => [
      ...prev,
      ...parsed.map((d) => ({
        display_name: d.display_name,
        is_reserve: false,
        racing_number: d.racing_number === null ? "" : String(d.racing_number),
        team_id: "",
      })),
    ]);
    setPasteText("");
  }

  const driverCount = rows.filter((r) => r.display_name.trim() !== "").length;

  async function handleSubmit() {
    const drivers = rows
      .filter((r) => r.display_name.trim() !== "")
      .map((r) => ({
        display_name: r.display_name.trim(),
        is_reserve: r.is_reserve,
        racing_number: r.racing_number.trim() === "" ? null : Number(r.racing_number),
        team_id: r.team_id || null,
      }));

    if (drivers.length === 0) {
      setError("Add at least one driver name before submitting.");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/drivers/bulk`, {
        body: JSON.stringify({ drivers }),
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        method: "POST",
      });

      const body = (await res.json().catch(() => ({}))) as {
        added?: number;
        error?: string;
        skipped?: number;
      };

      if (!res.ok) {
        setError(body.error ?? "Failed to add drivers");
        return;
      }

      setResult({ added: body.added ?? 0, skipped: body.skipped ?? 0 });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Paste-to-fill: the hero speed feature */}
      <div className="space-y-2 border border-f1-red bg-f1-dark p-4">
        <label className="text-xs font-bold uppercase text-f1-white" htmlFor="paste-roster">
          Paste a roster — one driver per line, optional car number e.g. &quot;Max Verstappen 1&quot;
        </label>
        <textarea
          className="min-h-24 w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="paste-roster"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button
          className="inline-flex min-h-11 items-center border border-f1-red bg-f1-red px-3 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pasteText.trim() === ""}
          type="button"
          onClick={addPastedRoster}
        >
          Add to grid
        </button>
      </div>

      {/* Editable grid */}
      <div className="overflow-x-auto border border-f1-border">
        <table className="w-full min-w-[640px] text-left text-sm text-f1-white">
          <thead>
            <tr className="border-b border-f1-border text-xs font-bold uppercase text-f1-muted">
              <th className="px-3 py-2" scope="col">Name</th>
              <th className="px-3 py-2" scope="col">No.</th>
              <th className="px-3 py-2" scope="col">Team</th>
              <th className="px-3 py-2" scope="col">Reserve</th>
              <th className="px-3 py-2" scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr className="border-b border-f1-border last:border-b-0" key={i}>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Driver name row ${i + 1}`}
                    className="w-full border border-f1-border bg-f1-dark px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none"
                    type="text"
                    value={row.display_name}
                    onChange={(e) => updateRow(i, { display_name: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Racing number row ${i + 1}`}
                    className="w-20 border border-f1-border bg-f1-dark px-2 py-1.5 font-mono text-sm text-f1-white focus:border-f1-red focus:outline-none"
                    min={0}
                    type="number"
                    value={row.racing_number}
                    onChange={(e) => updateRow(i, { racing_number: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Team row ${i + 1}`}
                    className="w-full border border-f1-border bg-f1-dark px-2 py-1.5 text-sm text-f1-white focus:border-f1-red focus:outline-none"
                    value={row.team_id}
                    onChange={(e) => updateRow(i, { team_id: e.target.value })}
                  >
                    <option value="">— No team (free agent) —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Reserve row ${i + 1}`}
                    className="accent-f1-red size-5"
                    checked={row.is_reserve}
                    type="checkbox"
                    onChange={(e) => updateRow(i, { is_reserve: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    aria-label={`Remove row ${i + 1}`}
                    className="text-xs font-bold uppercase text-f1-muted transition-colors hover:text-f1-red"
                    type="button"
                    onClick={() => removeRow(i)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-11 items-center border border-f1-border px-3 py-1.5 text-xs font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white"
          type="button"
          onClick={addRow}
        >
          + Add row
        </button>
        <button
          className="inline-flex min-h-11 items-center border border-f1-border px-3 py-1.5 text-xs font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={rows.length === 0}
          type="button"
          onClick={duplicateLastRow}
        >
          Duplicate last row
        </button>
      </div>

      <div className="space-y-2" aria-live="polite">
        <button
          className="w-full min-h-11 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={busy || !csrfToken}
          type="button"
          onClick={handleSubmit}
        >
          {busy ? "Adding…" : `Add ${driverCount} driver${driverCount === 1 ? "" : "s"}`}
        </button>
        {error && <p className="text-xs text-f1-red">{error}</p>}
        {result && (
          <div className="space-y-1">
            <p className="text-xs text-f1-muted">
              Added {result.added} driver{result.added === 1 ? "" : "s"}
              {result.skipped > 0
                ? ` — ${result.skipped} skipped (already enrolled or duplicate)`
                : ""}
            </p>
            <Link className="text-sm font-bold text-f1-red hover:underline" href={`/admin/leagues/${leagueId}`}>
              ← Back to league
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
