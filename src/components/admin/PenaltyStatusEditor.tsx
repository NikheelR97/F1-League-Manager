"use client";

import { useState } from "react";

import { FormError } from "@/components/ui/FormError";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";
import { PENALTY_STATUS_LABELS } from "@/lib/penalties/status-labels";

const STATUS_OPTIONS = ["open", "served", "appealed", "rescinded"] as const;
export type PenaltyStatus = (typeof STATUS_OPTIONS)[number];

interface Props {
  driverName: string;
  initialStatus: PenaltyStatus;
  penaltyId: string;
}

export function PenaltyStatusEditor({ driverName, initialStatus, penaltyId }: Props) {
  const csrfToken = useCsrfToken();
  const [savedStatus, setSavedStatus] = useState<PenaltyStatus>(initialStatus);
  const [status, setStatus] = useState<PenaltyStatus>(initialStatus);
  const [saveState, setSaveState] = useState<"error" | "idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: PenaltyStatus) {
    setStatus(next);
    setSaveState("idle");
    setError(null);
  }

  async function handleSave() {
    if (
      status === "rescinded" &&
      !window.confirm(
        "Rescind this penalty? It will be excluded from ban totals and standings will be recalculated.",
      )
    ) {
      return;
    }

    setSaveState("loading");
    setError(null);

    const res = await fetch(`/api/admin/penalties/${penaltyId}`, {
      body: JSON.stringify({ status }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "PATCH",
    });

    if (res.ok) {
      setSavedStatus(status);
      setSaveState("success");
    } else {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "Failed to update penalty status.");
      setSaveState("error");
    }
  }

  const dirty = status !== savedStatus;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          aria-label={`Penalty status for ${driverName}`}
          className="border border-f1-border bg-f1-dark px-2 py-1 text-xs text-f1-white"
          onChange={(e) => handleChange(e.target.value as PenaltyStatus)}
          value={status}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {PENALTY_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          className="border border-f1-red bg-f1-red px-3 py-1 text-xs font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
          disabled={!dirty || saveState === "loading"}
          onClick={handleSave}
          type="button"
        >
          {saveState === "loading" ? "Updating…" : "Save"}
        </button>
      </div>
      {saveState === "success" && !dirty && (
        <p className="text-xs text-green-400" role="status">
          Status updated — standings recalculated.
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}
