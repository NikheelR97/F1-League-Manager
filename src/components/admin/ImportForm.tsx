"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

import { DiffReport } from "./DiffReport";
import type { ImportDiff } from "@/lib/import/diff";

interface League {
  id: string;
  name: string;
  slug: string;
}

interface Season {
  id: string;
  name: string;
  starts_on: string;
  is_current: boolean;
  is_archived: boolean;
}

interface ImportFormProps {
  leagues: League[];
  seasons: Season[];
}

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "done"; migrationId: string; diff: ImportDiff; clean: boolean }
  | { phase: "confirming" }
  | { phase: "confirmed" }
  | { phase: "error"; message: string };

export function ImportForm({ leagues, seasons }: ImportFormProps) {
  const csrfToken = useCsrfToken();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? "");
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [state, setState] = useState<UploadState>({ phase: "idle" });

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!csrfToken) return;

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setState({ phase: "error", message: "Please select a file" });
      return;
    }

    setState({ phase: "uploading" });

    const fd = new FormData();
    fd.append("file", file);
    fd.append("league_id", leagueId);
    fd.append("season_id", seasonId);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: fd,
      });

      const data = (await res.json()) as {
        error?: string;
        migration_id?: string;
        diff?: ImportDiff;
        clean?: boolean;
      };

      if (!res.ok) {
        setState({ phase: "error", message: data.error ?? "Upload failed" });
        return;
      }

      setState({
        phase: "done",
        migrationId: data.migration_id!,
        diff: data.diff!,
        clean: data.clean!,
      });
    } catch {
      setState({ phase: "error", message: "Network error — please try again" });
    }
  }

  async function handleConfirm() {
    if (!csrfToken || state.phase !== "done") return;
    setState({ phase: "confirming" });

    try {
      const res = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ migration_id: state.migrationId }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setState({ phase: "error", message: data.error ?? "Confirm failed" });
        return;
      }

      setState({ phase: "confirmed" });
      router.refresh();
    } catch {
      setState({ phase: "error", message: "Network error — please try again" });
    }
  }

  const busy = state.phase === "uploading" || state.phase === "confirming";
  const disableUpload = busy || !csrfToken || !leagueId || !seasonId;

  return (
    <div className="space-y-6">
      <form className="space-y-4 border border-f1-border bg-f1-dark p-6" onSubmit={handleUpload}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase text-f1-muted" htmlFor="import-league">
              League
            </label>
            <select
              className="w-full border border-f1-border bg-f1-black px-3 py-2 text-sm text-f1-white disabled:opacity-50"
              disabled={busy}
              id="import-league"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase text-f1-muted" htmlFor="import-season">
              Season
            </label>
            <select
              className="w-full border border-f1-border bg-f1-black px-3 py-2 text-sm text-f1-white disabled:opacity-50"
              disabled={busy}
              id="import-season"
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.is_current ? " (current)" : ""}
                  {s.is_archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase text-f1-muted" htmlFor="import-file">
            Workbook (.xlsx)
          </label>
          <input
            accept=".xlsx"
            className="w-full border border-f1-border bg-f1-black px-3 py-2 text-sm text-f1-white file:mr-3 file:border-0 file:bg-f1-red file:px-3 file:py-1 file:text-xs file:font-bold file:uppercase file:text-white disabled:opacity-50"
            disabled={busy}
            id="import-file"
            ref={fileRef}
            type="file"
          />
        </div>

        <button
          className="border border-f1-red bg-f1-red px-4 py-2 text-xs font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disableUpload}
          type="submit"
        >
          {state.phase === "uploading" ? "Uploading…" : "Upload & Validate"}
        </button>
      </form>

      {state.phase === "error" && (
        <p className="border border-f1-red bg-f1-dark px-4 py-3 text-sm text-f1-red">
          {state.message}
        </p>
      )}

      {state.phase === "done" && (
        <div className="space-y-4">
          <DiffReport diff={state.diff} />

          {state.clean ? (
            <div className="flex items-center gap-4 border border-team-sauber bg-f1-dark p-4">
              <p className="flex-1 text-sm text-team-sauber">
                Diff is clean — all standings match. Confirm to lock this season against re-import.
              </p>
              <button
                className="border border-team-sauber px-4 py-2 text-xs font-bold uppercase text-team-sauber transition-colors hover:bg-team-sauber hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!csrfToken || busy}
                type="button"
                onClick={handleConfirm}
              >
                {busy ? "Confirming…" : "Confirm Import"}
              </button>
            </div>
          ) : (
            <p className="border border-f1-red bg-f1-dark px-4 py-3 text-sm text-f1-red">
              Diff has discrepancies — correct the data and re-upload before confirming.
            </p>
          )}
        </div>
      )}

      {state.phase === "confirmed" && (
        <p className="border border-team-sauber bg-f1-dark px-4 py-3 text-sm text-team-sauber">
          Import confirmed. This season is now locked against re-import.
        </p>
      )}
    </div>
  );
}
