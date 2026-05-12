import { readFileSync } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

// Source files for structural security assertions
const publishRoute = readFileSync("src/app/api/admin/sessions/[id]/publish/route.ts", "utf8");
const wheelSpinRoute = readFileSync("src/app/api/admin/leagues/[id]/wheel/spin/route.ts", "utf8");
const sessionCreateRoute = readFileSync("src/app/api/admin/leagues/[id]/sessions/route.ts", "utf8");
const adminGuard = readFileSync("src/lib/admin/api-guard.ts", "utf8");
const racerGuard = readFileSync("src/lib/racer/api-guard.ts", "utf8");
const requireAdminSrc = readFileSync("src/lib/auth/admin.ts", "utf8");
const envSrc = readFileSync("src/lib/env.ts", "utf8");
const racerSetupRoute = readFileSync("src/app/api/racer/setups/[id]/route.ts", "utf8");

const ADMIN_ROUTE_FILES = [
  "src/app/api/admin/leagues/route.ts",
  "src/app/api/admin/drivers/route.ts",
  "src/app/api/admin/seasons/route.ts",
  "src/app/api/admin/leagues/[id]/teams/route.ts",
  "src/app/api/admin/leagues/[id]/drivers/route.ts",
  "src/app/api/admin/leagues/[id]/transfers/route.ts",
  "src/app/api/admin/leagues/[id]/carry-over/route.ts",
  "src/app/api/admin/seasons/[id]/archive/route.ts",
  "src/app/api/admin/seasons/[id]/current/route.ts",
  "src/app/api/admin/users/[id]/role/route.ts",
  "src/app/api/admin/import/route.ts",
  "src/app/api/admin/import/confirm/route.ts",
];

// ---------------------------------------------------------------------------
// 1. Unauthenticated admin mutation returns 401
// ---------------------------------------------------------------------------

describe("S10 unauthenticated admin mutation blocked", () => {
  it("every mutating admin route uses withAdminGuard (which returns 401 for missing session)", () => {
    for (const file of ADMIN_ROUTE_FILES) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must use withAdminGuard`).toContain("withAdminGuard");
    }
  });

  it("requireAdminContext returns 401 for unauthenticated users", () => {
    expect(requireAdminSrc).toContain("status: 401");
    expect(requireAdminSrc).toContain("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// 2. Racer (non-admin) admin mutation returns 403
// ---------------------------------------------------------------------------

describe("S10 racer role blocked from admin routes", () => {
  it("requireAdminContext checks isAdminRole and returns 403 for non-admin", () => {
    expect(requireAdminSrc).toContain("isAdminRole");
    expect(requireAdminSrc).toContain("status: 403");
    expect(requireAdminSrc).toContain("Forbidden");
  });

  it("role is read from the profiles table on the server, never trusted from browser", () => {
    expect(requireAdminSrc).toContain("getProfileRole");
    // The role is never parsed from request body or query params
    expect(adminGuard).not.toContain("req.body?.role");
    expect(adminGuard).not.toContain('searchParams.get("role")');
  });
});

// ---------------------------------------------------------------------------
// 3. Admin mutation without CSRF returns 403
// ---------------------------------------------------------------------------

describe("S10 admin mutation without CSRF blocked", () => {
  it("admin guard verifies CSRF token for mutating requests", () => {
    expect(adminGuard).toContain("verifyCsrfToken");
    expect(adminGuard).toContain("403");
  });

  it("racer guard verifies CSRF token for mutating requests", () => {
    expect(racerGuard).toContain("verifyCsrfToken");
    expect(racerGuard).toContain("403");
  });
});

// ---------------------------------------------------------------------------
// 4. Client-supplied points are blocked
// ---------------------------------------------------------------------------

describe("S10 client-supplied points blocked", () => {
  it("publish route schema has no points_awarded field", () => {
    expect(publishRoute).not.toContain("points_awarded");
  });

  it("publish route calls calculateRacePoints via publishSession (server-authoritative)", () => {
    expect(publishRoute).toContain("publishSession");
    // points_awarded must not appear in the incoming Zod schema
    const schemaBlock = publishRoute.match(/const raceResultSchema[\s\S]+?z\.object\(\{[\s\S]+?\}\)/)?.[0] ?? "";
    expect(schemaBlock).not.toContain("points_awarded");
  });

  it("publish route schema intentionally omits points_awarded (comment confirms)", () => {
    expect(publishRoute).toContain("intentionally absent");
  });
});

// ---------------------------------------------------------------------------
// 5. Forged wheel result is blocked
// ---------------------------------------------------------------------------

describe("S10 forged wheel result blocked", () => {
  it("wheel spin route selects circuit server-side via selectWheelCircuit", () => {
    expect(wheelSpinRoute).toContain("selectWheelCircuit");
  });

  it("wheel spin route stores result in DB before returning to client", () => {
    expect(wheelSpinRoute).toContain(".insert(");
    expect(wheelSpinRoute).toContain("circuit_id: chosen.circuit_id");
  });

  it("session create route cross-validates wheel circuit against DB spin record", () => {
    // Client sends wheel_spin_id; server fetches spin from DB and validates circuit matches
    expect(sessionCreateRoute).toContain("wheel_spin_id");
    expect(sessionCreateRoute).toContain("wheel_spins");
    expect(sessionCreateRoute).toContain("validateWheelConfirmation");
    // The RPC confirms atomically using DB-stored spin, not raw client circuit
    expect(sessionCreateRoute).toContain("confirm_wheel_spin_session");
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-racer setup access is blocked
// ---------------------------------------------------------------------------

describe("S10 cross-racer setup isolation", () => {
  it("racer setup GET/PATCH/DELETE resolves ownership before returning data", () => {
    expect(racerSetupRoute).toContain("resolveOwnedSetup");
  });

  it("resolveOwnedSetup returns 404 (not 403) to avoid leaking existence", () => {
    expect(racerSetupRoute).toContain("404");
    // 403 must not appear as the response for not-found (existence leaking)
    const notFoundBlock = racerSetupRoute.match(/if \(!owned\)[\s\S]{0,200}/)?.[0] ?? "";
    expect(notFoundBlock).not.toContain("403");
  });

  it("setup list query filters by userId from session, not from browser input", () => {
    const listRoute = readFileSync("src/app/api/racer/setups/route.ts", "utf8");
    // List scopes to driverIds resolved from the authenticated userId, not from query params
    expect(listRoute).toContain(".in(\"driver_id\"");
    expect(listRoute).toContain("userId");
  });
});

// ---------------------------------------------------------------------------
// 7. Production errors are generic
// ---------------------------------------------------------------------------

describe("S10 production error sanitization", () => {
  it("admin guard sanitizes thrown errors using sanitizeError", () => {
    expect(adminGuard).toContain("sanitizeError");
    expect(adminGuard).toContain("NODE_ENV");
  });

  it("racer guard sanitizes thrown errors using sanitizeError", () => {
    expect(racerGuard).toContain("sanitizeError");
    expect(racerGuard).toContain("NODE_ENV");
  });
});

// ---------------------------------------------------------------------------
// 8. Service role key absent from client bundle
// ---------------------------------------------------------------------------

describe("S10 service role key absent from client bundle", () => {
  it("SUPABASE_SERVICE_ROLE_KEY is not prefixed with NEXT_PUBLIC_", () => {
    expect(envSrc).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("service-role client module has server-only directive", () => {
    const serviceRole = readFileSync("src/lib/supabase/service-role.ts", "utf8");
    expect(serviceRole).toContain("server-only");
  });

  it("service role key is absent from .next/static client chunks", () => {
    const staticDir = path.join(".next", "static");
    if (!existsSync(staticDir)) return; // skip if no build output

    let found = false;
    function scanDir(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          const content = readFileSync(fullPath, "utf8");
          if (content.includes("SUPABASE_SERVICE_ROLE_KEY") || content.includes("service_role")) {
            found = true;
          }
        }
      }
    }
    scanDir(staticDir);
    expect(found).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Invalid import files rejected before parsing
// ---------------------------------------------------------------------------

describe("S10 invalid import files rejected before parsing", () => {
  it("upload route rejects non-xlsx files before calling parseWorkbook", () => {
    const uploadRoute = readFileSync("src/app/api/admin/import/route.ts", "utf8");
    // Use the call site (await parseWorkbook), not the import statement
    const xlsxCheckIdx = uploadRoute.indexOf(".xlsx");
    const parseCallIdx = uploadRoute.indexOf("await parseWorkbook");
    expect(xlsxCheckIdx).toBeGreaterThan(-1);
    expect(parseCallIdx).toBeGreaterThan(-1);
    expect(xlsxCheckIdx).toBeLessThan(parseCallIdx);
  });

  it("upload route rejects oversized files before calling parseWorkbook", () => {
    const uploadRoute = readFileSync("src/app/api/admin/import/route.ts", "utf8");
    const sizeCheckIdx = uploadRoute.indexOf("MAX_WORKBOOK_BYTES");
    const parseCallIdx = uploadRoute.indexOf("await parseWorkbook");
    expect(sizeCheckIdx).toBeLessThan(parseCallIdx);
  });

  it("upload route validates UUID params before calling parseWorkbook", () => {
    const uploadRoute = readFileSync("src/app/api/admin/import/route.ts", "utf8");
    const zodIdx = uploadRoute.indexOf("safeParse");
    const parseCallIdx = uploadRoute.indexOf("await parseWorkbook");
    expect(zodIdx).toBeLessThan(parseCallIdx);
  });
});

// ---------------------------------------------------------------------------
// 10. Every state-changing admin route writes an audit log
// ---------------------------------------------------------------------------

describe("S10 admin mutations write audit logs", () => {
  const MUTATION_ROUTES_REQUIRING_AUDIT = [
    "src/app/api/admin/leagues/route.ts",
    "src/app/api/admin/leagues/[id]/teams/route.ts",
    "src/app/api/admin/leagues/[id]/drivers/route.ts",
    "src/app/api/admin/leagues/[id]/transfers/route.ts",
    "src/app/api/admin/leagues/[id]/carry-over/route.ts",
    "src/app/api/admin/leagues/[id]/status/route.ts",
    "src/app/api/admin/seasons/[id]/archive/route.ts",
    "src/app/api/admin/seasons/[id]/current/route.ts",
    "src/app/api/admin/users/[id]/role/route.ts",
    "src/app/api/admin/import/route.ts",
    "src/app/api/admin/import/confirm/route.ts",
    "src/app/api/admin/leagues/[id]/wheel/spin/route.ts",
    "src/app/api/admin/wheel-spins/[id]/void/route.ts",
  ];

  it("every state-changing admin route writes an audit log (directly or via service)", () => {
    const publishServiceSrc = readFileSync("src/lib/results/publish-service.ts", "utf8");
    // Publish delegates to publishSession which writes the log
    expect(publishServiceSrc).toContain("writeAdminAuditLog");

    for (const file of MUTATION_ROUTES_REQUIRING_AUDIT) {
      const src = readFileSync(file, "utf8");
      const hasDirectLog = src.includes("writeAdminAuditLog");
      // All routes in this list must write audit logs directly
      expect(hasDirectLog, `${file} must call writeAdminAuditLog`).toBe(true);
    }
  });
});
