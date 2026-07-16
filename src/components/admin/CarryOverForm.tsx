"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface Season {
  id: string;
  is_current?: boolean;
  name: string;
}

interface Props {
  leagueId: string;
  seasons: Season[];
}

export function CarryOverForm({ leagueId, seasons }: Props) {
  const csrfToken = useCsrfToken();
  const [fromId, setFromId] = useState(() => seasons.find((s) => s.is_current)?.id ?? "");
  const [toId, setToId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const toOptions = seasons.filter((s) => s.id !== fromId);
  const fromOptions = seasons.filter((s) => s.id !== toId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId || !toId) return;
    setStatus("loading");
    setMessage("");

    const res = await fetch(`/api/admin/leagues/${leagueId}/carry-over`, {
      body: JSON.stringify({
        from_season_id: fromId,
        to_season_id: toId,
      }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json() as { carried_over: number };
      setStatus("success");
      setMessage(`Carried over ${data.carried_over} driver(s). This season is now current.`);
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setMessage((body as { error?: string }).error ?? "Carry-over failed.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="carry-from">From Season</Label>
          <select
            className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white"
            id="carry-from"
            onChange={(e) => setFromId(e.target.value)}
            value={fromId}
          >
            <option value="">Select a season…</option>
            {fromOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="carry-to">To Season</Label>
          <select
            className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white"
            id="carry-to"
            onChange={(e) => setToId(e.target.value)}
            value={toId}
          >
            <option value="">Select a season…</option>
            {toOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-f1-muted">
        Copies each driver&apos;s end-of-season penalty points and ban-threshold flags into
        their entry for the target season, and makes the target season current. A carried
        flag means the driver crossed the alert threshold last season — it is not a recorded
        ban. Safe to re-run — existing entries are updated, not duplicated.
      </p>
      <button
        className="min-h-11 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={!fromId || !toId || status === "loading"}
        type="submit"
      >
        {status === "loading" ? "Applying…" : "Apply Carry-Over"}
      </button>
      {status === "success" && (
        <p className="text-xs text-green-400">{message}</p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive">{message}</p>
      )}
    </form>
  );
}
