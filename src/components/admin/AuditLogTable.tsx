"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface AuditLog {
  action: string;
  actor_id: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  id: string;
  metadata: Record<string, unknown>;
  // Supabase types many-to-one joins as arrays; runtime value is a single object or null.
  profiles: { display_name: string | null }[] | { display_name: string | null } | null;
}

interface Props {
  limit: number;
  logs: AuditLog[];
  offset: number;
}

export function AuditLogTable({ limit, logs, offset }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (newOffset: number) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("offset", String(newOffset));
      router.push(`?${p.toString()}`);
    },
    [router, searchParams],
  );

  if (!logs.length) {
    return <p className="text-sm text-f1-muted">No audit logs found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border text-left text-xs uppercase text-f1-muted">
              <th className="pb-2 pr-4">Time</th>
              <th className="pb-2 pr-4">Actor</th>
              <th className="pb-2 pr-4">Action</th>
              <th className="pb-2 pr-4">Entity</th>
              <th className="pb-2">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                className="border-b border-f1-border py-2 align-top"
                key={log.id}
              >
                <td className="py-2 pr-4 font-mono text-xs text-f1-muted">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-f1-white">
                  {(Array.isArray(log.profiles)
                    ? log.profiles[0]?.display_name
                    : log.profiles?.display_name) ??
                    log.actor_id?.slice(0, 8) ??
                    "—"}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-f1-white">
                  {log.action}
                </td>
                <td className="py-2 pr-4 text-xs text-f1-muted">
                  {log.entity_type}
                  {log.entity_id && (
                    <span className="ml-1 font-mono">
                      {log.entity_id.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="py-2 font-mono text-xs text-f1-muted" title={JSON.stringify(log.metadata)}>
                  {Object.keys(log.metadata).length > 0
                    ? (() => {
                        const s = JSON.stringify(log.metadata);
                        return s.length > 120 ? `${s.slice(0, 120)}…` : s;
                      })()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        {offset > 0 && (
          <button
            className="text-sm text-f1-red hover:underline"
            onClick={() => navigate(Math.max(0, offset - limit))}
            type="button"
          >
            ← Previous
          </button>
        )}
        {logs.length === limit && (
          <button
            className="text-sm text-f1-red hover:underline"
            onClick={() => navigate(offset + limit)}
            type="button"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
