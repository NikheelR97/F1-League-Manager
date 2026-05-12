"use client";

import { Copy, MapPin, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface SetupCardProps {
  id: string;
  name: string;
  circuitName: string;
  circuitCountry: string;
  gameVersion: string | null;
  weather: string | null;
  isPublic: boolean;
  updatedAt: string;
}

export function SetupCard({
  id,
  name,
  circuitName,
  circuitCountry,
  gameVersion,
  weather,
  isPublic,
  updatedAt,
}: SetupCardProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/racer/setups/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/racer/setups/${id}/duplicate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const updatedDate = new Date(updatedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col border border-f1-border bg-f1-dark transition-colors hover:border-f1-red">
      <div className="border-b border-f1-border bg-black/20 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold text-f1-white">{name}</h3>
          {isPublic && (
            <span className="shrink-0 border border-f1-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-f1-muted">
              Public
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-sm text-f1-muted">
          <MapPin size={13} />
          {circuitName}, {circuitCountry}
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {gameVersion && (
            <span className="border border-f1-border px-2 py-0.5 font-mono text-[10px] text-f1-muted">
              {gameVersion}
            </span>
          )}
          {weather && (
            <span className="border border-f1-border px-2 py-0.5 font-mono text-[10px] text-f1-muted">
              {weather}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-f1-border pt-3">
          <p className="text-[10px] text-f1-muted">Updated {updatedDate}</p>
          <div className="flex items-center gap-1">
            <button
              aria-label="Duplicate setup"
              className="rounded-none border border-transparent p-1.5 text-f1-muted transition-colors hover:border-f1-border hover:text-f1-white disabled:opacity-50"
              disabled={busy}
              onClick={handleDuplicate}
              type="button"
            >
              <Copy size={14} />
            </button>
            <Link
              aria-label="Edit setup"
              className="rounded-none border border-transparent p-1.5 text-f1-muted transition-colors hover:border-f1-border hover:text-f1-white"
              href={`/garage/${id}/edit`}
            >
              <Pencil size={14} />
            </Link>
            <button
              aria-label="Delete setup"
              className="rounded-none border border-transparent p-1.5 text-f1-muted transition-colors hover:border-f1-red hover:text-f1-red disabled:opacity-50"
              disabled={busy}
              onClick={handleDelete}
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
