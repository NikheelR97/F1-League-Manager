import "server-only";

import { type NextRequest } from "next/server";

import { MAX_REQUEST_BODY_BYTES } from "@/lib/constants";
import { readServerEnv } from "@/lib/env";
import { readPublicEnv } from "@/lib/env-public";
import { verifyCsrfToken } from "@/lib/security/csrf";
import { sanitizeError } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface RacerContext {
  userId: string;
}

export type RacerGuardHandler = (
  req: NextRequest,
  ctx: RacerContext,
) => Promise<Response>;

export async function withRacerGuard(
  req: NextRequest,
  handler: RacerGuardHandler,
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
        (req.headers.get("referer")
          ? new URL(req.headers.get("referer")!).origin
          : null);
      if (requestOrigin !== expectedOrigin) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 3. Session — any authenticated user can manage their own setups
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 4. CSRF for writes
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      const { CSRF_SECRET } = readServerEnv();
      if (!verifyCsrfToken(req, CSRF_SECRET)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return await handler(req, { userId: user.id });
  } catch (error) {
    const body = sanitizeError(error, process.env.NODE_ENV === "production");
    return Response.json(body, { status: 500 });
  }
}
