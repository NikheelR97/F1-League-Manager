import "server-only";

import { type NextRequest } from "next/server";

import { writeAuditLog, type AuditEntry } from "@/lib/audit/audit-log";
import { requireAdminContext, type AdminAuthResult } from "@/lib/auth/admin";
import { MAX_REQUEST_BODY_BYTES } from "@/lib/constants";
import { readServerEnv } from "@/lib/env";
import { readPublicEnv } from "@/lib/env-public";
import { verifyCsrfToken } from "@/lib/security/csrf";
import { sanitizeError } from "@/lib/security/errors";
import { createAdminRateLimiter } from "@/lib/security/rate-limit";
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
  options: { skipCsrf?: boolean } = {},
): Promise<Response> {
  try {
    // 1. Content-type + size check for mutating methods
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      const contentLength = Number(req.headers.get("content-length") ?? 0);
      if (contentLength > MAX_REQUEST_BODY_BYTES) {
        return Response.json({ error: "Payload too large" }, { status: 413 });
      }
    }

    // 2. Origin check for mutating methods
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      const { NEXT_PUBLIC_SITE_URL } = readPublicEnv();
      const expectedOrigin = new URL(NEXT_PUBLIC_SITE_URL).origin;
      const requestOrigin =
        req.headers.get("origin") ??
        (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
      if (requestOrigin !== expectedOrigin) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 4. Session + role (always read from DB, never from browser)
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

    // 5. Rate limiting — keyed per admin user; skipped in dev when Redis is absent
    const rateLimiter = createAdminRateLimiter();
    if (rateLimiter) {
      const { success } = await rateLimiter.limit(authResult.user.id);
      if (!success) {
        return Response.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    // 6. CSRF for writes — verified against server secret, not client-supplied value
    if (!options.skipCsrf) {
      const { CSRF_SECRET } = readServerEnv();
      if (!verifyCsrfToken(req, CSRF_SECRET)) {
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
