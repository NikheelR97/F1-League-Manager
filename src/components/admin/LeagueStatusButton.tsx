"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface LeagueStatusButtonProps {
  leagueId: string;
  currentStatus: string;
}

const NEXT_STATUS: Record<string, { label: string; target: "active" | "archived" }> = {
  draft: { label: "Activate League", target: "active" },
  active: { label: "Archive League", target: "archived" },
};

export function LeagueStatusButton({ leagueId, currentStatus }: LeagueStatusButtonProps) {
  const csrfToken = useCsrfToken();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const next = NEXT_STATUS[currentStatus];
  if (!next) return null;

  async function handleClick() {
    if (!csrfToken) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/status`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ status: next.target }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update status");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const isDanger = next.target === "archived";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className={`border px-3 py-1.5 text-xs font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isDanger
            ? "border-f1-muted text-f1-muted hover:border-f1-red hover:text-f1-red"
            : "border-team-sauber bg-team-sauber text-white hover:bg-white hover:text-f1-black"
        }`}
        disabled={busy || !csrfToken}
        type="button"
        onClick={handleClick}
      >
        {busy ? "Updating…" : next.label}
      </button>
      {error && <p className="text-xs text-f1-red">{error}</p>}
    </div>
  );
}
