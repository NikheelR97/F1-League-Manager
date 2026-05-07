import "server-only";

import { type NextRequest } from "next/server";

import { writeAuditLog, type AuditEntry } from "@/lib/audit/audit-log";
import { requireAdminContext, type AdminAuthResult } from "@/lib/auth/admin";
import { MAX_REQUEST_BODY_BYTES } from "@/lib/constants";
import { verifyCsrfToken } from "@/lib/security/csrf";
import { sanitizeError } from "@/lib/security/errors";
import { createSupabaseAdminAuthReader } from "@/lib/supabase/admin-reader";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GuardedHandler = (
  req: NextRequest,
  auth: Extract<AdminAuthResult, { ok: true }>,
) => Promise<Response>;

export async function withAdminGuard(
  req: NextRequest,
  handler: GuardedHandler,
  options: { csrfToken?: string; skipCsrf?: boolean } = {},
): Promise<Response> {
  try {
    // 1. Content-type + size check for mutating methods
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      const contentLength = Number(req.headers.get("content-length") ?? 0);
      if (contentLength > MAX_REQUEST_BODY_BYTES) {
        return Response.json({ error: "Payload too large" }, { status: 413 });
      }
    }

    // 2. Session + role (always read from DB, never from browser)
    const supabase = await createSupabaseServerClient();
    const authResult = await requireAdminContext(
      createSupabaseAdminAuthReader(supabase),
    );
    if (!authResult.ok) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    // 3. CSRF for writes
    if (!options.skipCsrf) {
      const csrfToken = options.csrfToken ?? req.headers.get("x-csrf-token") ?? "";
      if (!verifyCsrfToken(req, csrfToken)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return await handler(req, authResult);
  } catch (error) {
    const body = sanitizeError(error, process.env.NODE_ENV === "production");
    return Response.json(body, { status: 500 });
  }
}

export async function writeAdminAuditLog(entry: Omit<AuditEntry, "actorId"> & { actorId: string }): Promise<void> {
  const serviceClient = createSupabaseServiceRoleClient();
  await writeAuditLog(
    {
      insertAuditLog: async (e) => {
        const { error } = await serviceClient.from("audit_logs").insert({
          action: e.action,
          actor_id: e.actorId,
          entity_id: e.entityId,
          entity_type: e.entityType,
          metadata: e.metadata,
        });
        return error ? { ok: false, error: error.message } : { ok: true };
      },
    },
    entry,
  );
}
