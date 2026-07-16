"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface RecalculateStandingsButtonProps {
  leagueId: string;
}

// S13-B4 — manual GUI trigger mirroring the automatic recalc that already
// runs on publish / points-system edit / carry-over.
export function RecalculateStandingsButton({ leagueId }: RecalculateStandingsButtonProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/recalculate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to recalculate standings");
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="inline-flex items-center min-h-11 border border-f1-border px-3 py-1 text-xs font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || !csrfToken}
        type="button"
        onClick={handleClick}
      >
        {busy ? "Recalculating…" : "Recalculate standings"}
      </button>
      {error && <p className="text-xs text-f1-red">{error}</p>}
    </div>
  );
}
