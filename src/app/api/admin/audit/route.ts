import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard } from "@/lib/admin/api-guard";
import { MAX_AUDIT_LOGS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const querySchema = z.object({
  action: z.string().trim().max(80).optional(),
  actor_id: z.string().uuid().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  entity_id: z.string().uuid().optional(),
  entity_type: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_AUDIT_LOGS_LIST).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  return withAdminGuard(req, async () => {
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
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
      return Response.json({ error: "Failed to load audit logs" }, { status: 500 });
    }

    return Response.json({ logs: data, limit, offset });
  }, { skipCsrf: true });
}
