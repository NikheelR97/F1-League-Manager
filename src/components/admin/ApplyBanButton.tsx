"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface ApplyBanButtonProps {
  driverId: string;
  driverName: string;
  leagueId: string;
  seasonId: string;
}

// M8 — one-click enforcement for a Ban Watch row: sets pending_ban on the
// driver's season entry so the next session's publish form pre-selects
// Status=BAN for them (see ResultStepper).
export function ApplyBanButton({ driverId, driverName, leagueId, seasonId }: ApplyBanButtonProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (!confirm(`Ban ${driverName} for the next round?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/drivers/${driverId}/pending-ban`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ season_id: seasonId }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to apply ban");
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
        className="border border-f1-red px-2 py-0.5 text-xs font-bold uppercase text-f1-red-text transition-colors hover:bg-f1-red hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || !csrfToken}
        type="button"
        onClick={handleClick}
      >
        {busy ? "Applying…" : "Apply ban"}
      </button>
      {error && <p className="text-xs text-f1-red">{error}</p>}
    </div>
  );
}
