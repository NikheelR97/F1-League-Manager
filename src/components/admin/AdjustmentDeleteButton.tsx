"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";

interface AdjustmentDeleteButtonProps {
  adjustmentId: string;
  targetName: string;
}

export function AdjustmentDeleteButton({ adjustmentId, targetName }: AdjustmentDeleteButtonProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  // K2 — the button self-replaces with a status message; without this,
  // focus falls back to <body> before the delayed router.refresh() below.
  const statusRef = useFocusOnMount<HTMLParagraphElement>(isDeleted);

  async function handleDelete() {
    if (
      !confirm(
        `Delete this adjustment for ${targetName}? Standings will be recalculated immediately.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/adjustments/${adjustmentId}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Failed to delete adjustment");
        return;
      }

      setIsDeleted(true);
      // ponytail: fixed delay so screen readers get to announce the status
      // message before router.refresh() removes this row from the list
      // (same pattern as SessionDeleteButton).
      setTimeout(() => router.refresh(), 1000);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isDeleted) {
    return (
      <p
        className="text-xs font-bold uppercase text-f1-muted"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        Adjustment deleted — standings recalculated.
      </p>
    );
  }

  return (
    <button
      aria-label={`Delete adjustment for ${targetName}`}
      className="p-1 text-f1-muted transition-colors hover:text-f1-red disabled:opacity-50"
      disabled={isDeleting}
      onClick={handleDelete}
      title="Delete Adjustment"
    >
      <Trash2 aria-hidden="true" size={16} />
    </button>
  );
}
