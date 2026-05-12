"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface Season {
  id: string;
  name: string;
}

interface Props {
  currentSeasonId: string;
  leagueId: string;
  seasons: Season[];
}

export function CarryOverForm({ currentSeasonId, leagueId, seasons }: Props) {
  const csrfToken = useCsrfToken();
  const [sourceId, setSourceId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const otherSeasons = seasons.filter((s) => s.id !== currentSeasonId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId) return;
    setStatus("loading");
    setMessage("");

    const res = await fetch(`/api/admin/leagues/${leagueId}/carry-over`, {
      body: JSON.stringify({
        source_season_id: sourceId,
        target_season_id: currentSeasonId,
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
      setMessage(`Carried over ${data.carried_over} driver(s) into this season.`);
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setMessage((body as { error?: string }).error ?? "Carry-over failed.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="carry-source">Source Season</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white"
          id="carry-source"
          onChange={(e) => setSourceId(e.target.value)}
          value={sourceId}
        >
          <option value="">Select a season…</option>
          {otherSeasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-f1-muted">
        Copies each driver&apos;s end-of-season penalty points and unserved bans
        into their entry for this season. Safe to re-run — existing entries are
        updated, not duplicated.
      </p>
      <button
        className="border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={!sourceId || status === "loading"}
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
