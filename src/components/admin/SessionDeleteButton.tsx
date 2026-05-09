"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

export function SessionDeleteButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Failed to delete session");
        return;
      }

      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      className="p-1 text-f1-muted transition-colors hover:text-f1-red disabled:opacity-50"
      disabled={isDeleting}
      title="Delete Session"
      onClick={handleDelete}
    >
      <Trash2 aria-hidden="true" size={16} />
    </button>
  );
}
