"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface Props {
  isCurrent: boolean;
  isArchived: boolean;
  seasonId: string;
}

export function SeasonActions({ isCurrent, isArchived, seasonId }: Props) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(path: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(path, {
      headers: { "x-csrf-token": csrfToken },
      method: "PATCH",
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      {!isCurrent && !isArchived && (
        <button
          className="border border-f1-red px-4 py-2 text-sm font-bold uppercase text-f1-red transition-colors hover:bg-f1-red hover:text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => patch(`/api/admin/seasons/${seasonId}/current`)}
          type="button"
        >
          Mark as Current
        </button>
      )}
      {!isCurrent && (
        <button
          className="border border-f1-border px-4 py-2 text-sm font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white disabled:opacity-50"
          disabled={busy}
          onClick={() => patch(`/api/admin/seasons/${seasonId}/archive`)}
          type="button"
        >
          {isArchived ? "Unarchive" : "Archive"}
        </button>
      )}
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
