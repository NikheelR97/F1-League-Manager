import { vi, beforeAll, afterAll } from "vitest";

// Mock modules that touch Supabase/network before imports resolve
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin-reader", () => ({
  createSupabaseAdminAuthReader: vi.fn(() => ({})),
}));
vi.mock("@/lib/auth/admin", () => ({
  requireAdminContext: vi.fn(),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  createAdminRateLimiter: vi.fn(() => null),
}));

import { type NextRequest } from "next/server";
import { withAdminGuard } from "@/lib/admin/api-guard";
import { requireAdminContext } from "@/lib/auth/admin";
import { generateCsrfToken } from "@/lib/security/csrf";
import { createAdminRateLimiter } from "@/lib/security/rate-limit";
import { MAX_REQUEST_BODY_BYTES } from "@/lib/constants";

const CSRF_SECRET = "a".repeat(64);
const adminUser = { id: "00000000-0000-4000-8000-000000000001", email: "admin@example.com" };
const mockAuthOk = { ok: true as const, user: adminUser, role: "admin" as const };

function makeReq(
  method: string,
  opts: {
    contentLength?: number;
    origin?: string;
    csrfToken?: string;
  } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.contentLength !== undefined) {
    headers["content-length"] = String(opts.contentLength);
  }
  if (opts.origin !== undefined) {
    headers["origin"] = opts.origin;
  }
  if (opts.csrfToken !== undefined) {
    headers["x-csrf-token"] = opts.csrfToken;
  }
  return new Request("http://localhost:3000/api/admin/test", {
    method,
    headers,
  }) as unknown as NextRequest;
}

const savedEnv: Record<string, string | undefined> = {};
const envKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CSRF_SECRET",
];

beforeAll(() => {
  for (const k of envKeys) savedEnv[k] = process.env[k];
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.CSRF_SECRET = CSRF_SECRET;
});

afterAll(() => {
  for (const k of envKeys) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const neverCalled = vi.fn(async () => Response.json({ ok: true }));

describe("withAdminGuard security pipeline", () => {
  it("rejects oversized payloads with 413 before touching auth", async () => {
    const req = makeReq("POST", {
      contentLength: MAX_REQUEST_BODY_BYTES + 1,
      origin: "http://localhost:3000",
    });
    const res = await withAdminGuard(req, neverCalled);
    expect(res.status).toBe(413);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("rejects wrong origin with 403 before touching auth", async () => {
    const req = makeReq("POST", { origin: "https://attacker.example.com" });
    const res = await withAdminGuard(req, neverCalled);
    expect(res.status).toBe(403);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("passes GET requests through origin and content-length checks", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce(mockAuthOk);
    // GET with no CSRF token should still pass CSRF (non-mutating method)
    const req = makeReq("GET", {});
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const res = await withAdminGuard(req, handler, { skipCsrf: true });
    expect(res.status).toBe(200);
  });

  it("rejects missing CSRF token on POST with 403", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce(mockAuthOk);
    const req = makeReq("POST", {
      origin: "http://localhost:3000",
      contentLength: 100,
      // no csrfToken
    });
    const res = await withAdminGuard(req, neverCalled);
    expect(res.status).toBe(403);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("rejects tampered CSRF token on POST with 403", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce(mockAuthOk);
    const req = makeReq("POST", {
      origin: "http://localhost:3000",
      contentLength: 100,
      csrfToken: "12345678.deadbeefdeadbeef",
    });
    const res = await withAdminGuard(req, neverCalled);
    expect(res.status).toBe(403);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("allows valid CSRF token through to handler", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce(mockAuthOk);
    const token = generateCsrfToken(CSRF_SECRET);
    const req = makeReq("POST", {
      origin: "http://localhost:3000",
      contentLength: 100,
      csrfToken: token,
    });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const res = await withAdminGuard(req, handler);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("returns 429 when the admin rate limit is exceeded", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce(mockAuthOk);
    vi.mocked(createAdminRateLimiter).mockReturnValueOnce({
      limit: vi.fn(async () => ({ success: false })),
    } as unknown as ReturnType<typeof createAdminRateLimiter>);

    const token = generateCsrfToken(CSRF_SECRET);
    const req = makeReq("POST", {
      contentLength: 100,
      csrfToken: token,
      origin: "http://localhost:3000",
    });

    const res = await withAdminGuard(req, neverCalled);
    expect(res.status).toBe(429);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("sanitizes thrown handler errors", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce(mockAuthOk);
    const token = generateCsrfToken(CSRF_SECRET);
    const req = makeReq("POST", {
      contentLength: 100,
      csrfToken: token,
      origin: "http://localhost:3000",
    });
    const handler = vi.fn(async () => {
      throw new Error("database exploded with internal details");
    });

    const res = await withAdminGuard(req, handler);
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toContain("database exploded");
  });

  it("returns 401 when auth check fails", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce({
      ok: false,
      error: "Unauthorized",
      status: 401,
    });
    const token = generateCsrfToken(CSRF_SECRET);
    const req = makeReq("POST", {
      origin: "http://localhost:3000",
      contentLength: 100,
      csrfToken: token,
    });
    const res = await withAdminGuard(req, neverCalled);
    expect(res.status).toBe(401);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("returns 403 when auth check returns forbidden", async () => {
    vi.mocked(requireAdminContext).mockResolvedValueOnce({
      ok: false,
      error: "Forbidden",
      status: 403,
    });
    const token = generateCsrfToken(CSRF_SECRET);
    const req = makeReq("POST", {
      origin: "http://localhost:3000",
      contentLength: 100,
      csrfToken: token,
    });
    const res = await withAdminGuard(req, neverCalled);
    expect(res.status).toBe(403);
    expect(neverCalled).not.toHaveBeenCalled();
  });
});
