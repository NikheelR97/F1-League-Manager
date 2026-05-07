import { writeAuditLog, type AuditLogWriter } from "@/lib/audit/audit-log";
import { MAX_AUDIT_METADATA_BYTES } from "@/lib/constants";
import { createAdminRateLimiter } from "@/lib/security/rate-limit";
import { sanitizeError } from "@/lib/security/errors";
import { verifyCsrfToken } from "@/lib/security/csrf";
import nextConfig from "../../../next.config";

const actorId = "00000000-0000-4000-8000-000000000010";

describe("security helpers", () => {
  it("requires valid CSRF tokens for mutating requests", () => {
    const request = new Request("http://localhost/api/admin", {
      headers: { "x-csrf-token": "expected-token" },
      method: "POST",
    });

    expect(verifyCsrfToken(request, "expected-token")).toBe(true);
    expect(verifyCsrfToken(request, "wrong-token")).toBe(false);
    expect(verifyCsrfToken(new Request("http://localhost/api"), "")).toBe(true);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        verifyCsrfToken(new Request("http://localhost/api", { method }), ""),
      ).toBe(false);
    }
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

  it("fails closed for missing production rate limit configuration", () => {
    expect(createAdminRateLimiter({ NODE_ENV: "development" })).toBeNull();
    expect(() =>
      createAdminRateLimiter({ NODE_ENV: "production" }),
    ).toThrow("Rate limiting requires Upstash Redis in production");
  });
});
