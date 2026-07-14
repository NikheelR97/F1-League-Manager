"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface AddOfficialTeamsButtonProps {
  leagueId: string;
}

// One-click bulk add of every official F1 team template, so admins don't have
// to add them one at a time. Skips already-added teams and respects the cap
// server-side.
export function AddOfficialTeamsButton({ leagueId }: AddOfficialTeamsButtonProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleClick() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/teams/official`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
      });

      const body = (await res.json().catch(() => ({}))) as {
        added?: number;
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        setError(body.error ?? "Failed to add official teams");
        return;
      }

      const added = body.added ?? 0;
      setMessage(
        added > 0
          ? `Added ${added} official team${added === 1 ? "" : "s"}.`
          : body.message ?? "Nothing to add.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="inline-flex items-center min-h-11 gap-2 border border-f1-border px-3 py-1.5 text-xs font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || !csrfToken}
        type="button"
        onClick={handleClick}
      >
        {busy ? "Adding…" : "Add official teams"}
      </button>
      {message && <p className="text-xs text-f1-muted">{message}</p>}
      {error && <p className="text-xs text-f1-red">{error}</p>}
    </div>
  );
}
