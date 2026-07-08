/**
 * Test-only session endpoint used by Playwright global setup to authenticate
 * test users without a login UI.
 *
 * Hard-blocked in production via NODE_ENV check and a required E2E_SECRET
 * header so it can never be used against staging or prod instances.
 *
 * Called by: e2e/global-setup.ts
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { MAX_AUTH_COOKIES } from "@/lib/constants";
import { readPublicEnv } from "@/lib/env-public";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<Response> {
  // Block production deployments, but allow local Playwright to exercise the
  // production build through scripts/start-e2e-server.mjs.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.E2E_SESSION_ENABLED !== "true"
  ) {
    return new Response(null, { status: 404 });
  }

  // Require the shared test secret so this can't be called without the env var
  const expectedSecret = process.env.E2E_SECRET;
  if (!expectedSecret || req.headers.get("x-e2e-secret") !== expectedSecret) {
    return new Response(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Missing or invalid email/password" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const env = readPublicEnv();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const bounded = cookiesToSet.slice(0, MAX_AUTH_COOKIES);
            for (const { name, value, options } of bounded) {
              cookieStore.set(name, value, options);
            }
          } catch {}
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return Response.json({ error: "Authentication failed" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
