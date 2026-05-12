"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

type Role = "racer" | "admin" | "super_admin";

interface Props {
  currentRole: Role;
  displayName: string | null;
  userId: string;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  racer: "Racer",
  super_admin: "Super Admin",
};

export function UserRoleForm({ currentRole, displayName, userId }: Props) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [role, setRole] = useState<Role>(currentRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = role !== currentRole;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}/role`, {
      body: JSON.stringify({ role }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "PATCH",
    });

    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "Failed to update role.");
      return;
    }
    router.refresh();
  }

  return (
    <form className="flex items-end gap-3" onSubmit={handleSubmit}>
      <div className="flex-1 space-y-1">
        <Label htmlFor={`role-${userId}`}>
          {displayName ?? "Unknown user"}
        </Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white"
          id={`role-${userId}`}
          onChange={(e) => setRole(e.target.value as Role)}
          value={role}
        >
          {(["racer", "admin", "super_admin"] as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <button
        className="border border-f1-red px-4 py-2 text-sm font-bold uppercase text-f1-red transition-colors hover:bg-f1-red hover:text-white disabled:opacity-50"
        disabled={!dirty || busy}
        type="submit"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
