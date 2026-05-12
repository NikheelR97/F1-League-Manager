import "server-only";

import { Suspense } from "react";
import { z } from "zod";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { MAX_AUDIT_LOGS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const searchParamsSchema = z.object({
  action: z.string().trim().max(80).optional(),
  actor_id: z.string().uuid().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  entity_id: z.string().uuid().optional(),
  entity_type: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_AUDIT_LOGS_LIST).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return <ErrorState message="Invalid filter parameters." />;
  }

  const { action, actor_id, date_from, date_to, entity_id, entity_type, limit, offset } =
    parsed.data;

  const db = createSupabaseServiceRoleClient();
  let query = db
    .from("audit_logs")
    .select(
      "id, action, actor_id, entity_type, entity_id, metadata, created_at, profiles(display_name)",
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actor_id) query = query.eq("actor_id", actor_id);
  if (action) query = query.ilike("action", `%${action}%`);
  if (entity_type) query = query.eq("entity_type", entity_type);
  if (entity_id) query = query.eq("entity_id", entity_id);
  if (date_from) query = query.gte("created_at", date_from);
  if (date_to) query = query.lte("created_at", `${date_to}T23:59:59Z`);

  const { data, error } = await query;

  if (error) {
    return <ErrorState message="Failed to load audit logs." />;
  }

  // Supabase types many-to-one joins as arrays; AuditLogTable handles both forms.
  const logs = (data ?? []) as Parameters<typeof AuditLogTable>[0]["logs"];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Append-only record of all admin and system actions."
        title="Audit Log"
      />
      <Suspense>
        <AuditLogTable limit={limit} logs={logs} offset={offset} />
      </Suspense>
    </div>
  );
}
