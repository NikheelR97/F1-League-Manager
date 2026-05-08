import { writeAuditLog, type AuditLogWriter } from "@/lib/audit/audit-log";
import { MAX_AUDIT_METADATA_BYTES } from "@/lib/constants";
import { createAdminRateLimiter } from "@/lib/security/rate-limit";
import { sanitizeError } from "@/lib/security/errors";
import { generateCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import nextConfig, { getSupabaseRemotePatterns } from "../../../next.config";

const actorId = "00000000-0000-4000-8000-000000000010";

describe("security helpers", () => {
  it("requires valid CSRF tokens for mutating requests", () => {
    const secret = "a".repeat(64);
    const token = generateCsrfToken(secret);

    const validRequest = new Request("http://localhost/api/admin", {
      headers: { "x-csrf-token": token },
      method: "POST",
    });
    expect(verifyCsrfToken(validRequest, secret)).toBe(true);

    // Wrong secret must fail
    expect(verifyCsrfToken(validRequest, "b".repeat(64))).toBe(false);

    // GET skips CSRF
    expect(verifyCsrfToken(new Request("http://localhost/api"), secret)).toBe(true);

    // Mutating requests with no token must fail
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        verifyCsrfToken(new Request("http://localhost/api", { method }), secret),
      ).toBe(false);
    }

    // Tampered token (wrong hmac) must fail
    const [ts] = token.split(".");
    const tampered = new Request("http://localhost/api/admin", {
      headers: { "x-csrf-token": `${ts}.deadbeef` },
      method: "POST",
    });
    expect(verifyCsrfToken(tampered, secret)).toBe(false);

    // Malformed token (no dot) must fail
    const malformed = new Request("http://localhost/api/admin", {
      headers: { "x-csrf-token": "nodot" },
      method: "POST",
    });
    expect(verifyCsrfToken(malformed, secret)).toBe(false);
  });

  it("sanitizes production errors without leaking stack details", () => {
    const error = new Error("database password leaked in stack");

    expect(sanitizeError(error, true)).toEqual({ error: "Something went wrong" });
    expect(sanitizeError(error, false).error).toContain("database password");
    expect(sanitizeError("plain failure", false)).toEqual({
      error: "Unknown error",
    });
  });

  it("bounds audit metadata before writing", async () => {
    const writer: AuditLogWriter = {
      insertAuditLog: async () => ({ ok: true }),
    };

    await expect(
      writeAuditLog(writer, {
        action: "league.created",
        actorId,
        entityId: null,
        entityType: "league",
        metadata: { name: "Season 2" },
      }),
    ).resolves.toBeUndefined();

    await expect(
      writeAuditLog(writer, {
        action: "league.created",
        actorId,
        entityId: null,
        entityType: "league",
        metadata: { text: "x".repeat(MAX_AUDIT_METADATA_BYTES) },
      }),
    ).rejects.toThrow("Audit metadata is too large");

    await expect(
      writeAuditLog(
        { insertAuditLog: async () => ({ error: "insert failed", ok: false }) },
        {
          action: "league.created",
          actorId,
          entityId: null,
          entityType: "league",
          metadata: {},
        },
      ),
    ).rejects.toThrow("Audit log write failed");
  });

  it("adds security headers to every route", async () => {
    expect(nextConfig.headers).toBeDefined();

    const headerRules = await nextConfig.headers?.();
    const headerNames = headerRules?.[0]?.headers.map((header) => header.key);

    expect(headerNames).toContain("Content-Security-Policy");
    expect(headerNames).toContain("Strict-Transport-Security");
  });

  it("allows Supabase storage images when a public Supabase URL is configured", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    expect(getSupabaseRemotePatterns()).toEqual([
      {
        hostname: "127.0.0.1",
        pathname: "/storage/v1/object/public/**",
        port: "54321",
        protocol: "http",
      },
    ]);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "not a url";
    expect(getSupabaseRemotePatterns()).toEqual([]);

    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
  });

  it("fails closed for missing production rate limit configuration", () => {
    expect(createAdminRateLimiter({ NODE_ENV: "development" })).toBeNull();
    expect(() =>
      createAdminRateLimiter({ NODE_ENV: "production" }),
    ).toThrow("Rate limiting requires Upstash Redis in production");
  });
});
