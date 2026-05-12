import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

// Source files for security regression checks
const seasonCurrentRoute = readFileSync(
  "src/app/api/admin/seasons/[id]/current/route.ts",
  "utf8",
);
const seasonArchiveRoute = readFileSync(
  "src/app/api/admin/seasons/[id]/archive/route.ts",
  "utf8",
);
const usersRoute = readFileSync("src/app/api/admin/users/route.ts", "utf8");
const userRoleRoute = readFileSync(
  "src/app/api/admin/users/[id]/role/route.ts",
  "utf8",
);
const carryOverRoute = readFileSync(
  "src/app/api/admin/leagues/[id]/carry-over/route.ts",
  "utf8",
);
const auditRoute = readFileSync("src/app/api/admin/audit/route.ts", "utf8");
const s8Migration = readFileSync(
  "supabase/migrations/20260512000000_s8_admin_operations.sql",
  "utf8",
);

// ---------------------------------------------------------------------------
// Carry-over Zod schema (duplicated here to test in isolation)
// ---------------------------------------------------------------------------

const carryOverBodySchema = z.object({
  source_season_id: z.string().uuid(),
  target_season_id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// User role Zod schema
// ---------------------------------------------------------------------------

const userRoleBodySchema = z.object({
  role: z.enum(["racer", "admin", "super_admin"]),
});

// ---------------------------------------------------------------------------
// 1. Season — mark as current
// ---------------------------------------------------------------------------

describe("S8 season.set_current route", () => {
  it("uses withAdminGuard", () => {
    expect(seasonCurrentRoute).toContain("withAdminGuard");
  });

  it("refuses to mark an archived season as current", () => {
    // Route checks is_archived before updating — verify guard logic is present.
    expect(seasonCurrentRoute).toContain("is_archived");
    expect(seasonCurrentRoute).toContain("Cannot mark an archived season as current");
  });

  it("clears is_current on all other seasons", () => {
    expect(seasonCurrentRoute).toContain("is_current: false");
    expect(seasonCurrentRoute).toContain("neq");
  });

  it("writes audit log on success", () => {
    expect(seasonCurrentRoute).toContain("season.set_current");
    expect(seasonCurrentRoute).toContain("writeAdminAuditLog");
  });
});

// ---------------------------------------------------------------------------
// 2. Season — archive
// ---------------------------------------------------------------------------

describe("S8 season.archive route", () => {
  it("uses withAdminGuard", () => {
    expect(seasonArchiveRoute).toContain("withAdminGuard");
  });

  it("refuses to archive the current season", () => {
    expect(seasonArchiveRoute).toContain("is_current");
    expect(seasonArchiveRoute).toContain("Cannot archive the current season");
  });

  it("toggles archive status", () => {
    expect(seasonArchiveRoute).toContain("!season.is_archived");
  });

  it("writes audit log for both archive and unarchive", () => {
    expect(seasonArchiveRoute).toContain("season.archived");
    expect(seasonArchiveRoute).toContain("season.unarchived");
    expect(seasonArchiveRoute).toContain("writeAdminAuditLog");
  });
});

// ---------------------------------------------------------------------------
// 3. Carry-over schema and route
// ---------------------------------------------------------------------------

describe("S8 carry-over schema", () => {
  it("accepts valid UUIDs for both seasons", () => {
    const result = carryOverBodySchema.safeParse({
      source_season_id: "00000000-0000-4000-8000-000000000001",
      target_season_id: "00000000-0000-4000-8000-000000000002",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID source_season_id", () => {
    expect(
      carryOverBodySchema.safeParse({ source_season_id: "bad", target_season_id: "00000000-0000-4000-8000-000000000002" }).success,
    ).toBe(false);
  });

  it("rejects non-UUID target_season_id", () => {
    expect(
      carryOverBodySchema.safeParse({ source_season_id: "00000000-0000-4000-8000-000000000001", target_season_id: "" }).success,
    ).toBe(false);
  });
});

describe("S8 carry-over route", () => {
  it("uses withAdminGuard", () => {
    expect(carryOverRoute).toContain("withAdminGuard");
  });

  it("rejects when source and target seasons are the same", () => {
    expect(carryOverRoute).toContain("Source and target seasons must differ");
  });

  it("carries over penalty_points to carry_over_penalty_points", () => {
    expect(carryOverRoute).toContain("penalty_points");
    expect(carryOverRoute).toContain("carry_over_penalty_points");
  });

  it("carries over ban_threshold_reached to carry_over_ban_count", () => {
    expect(carryOverRoute).toContain("ban_threshold_reached");
    expect(carryOverRoute).toContain("carry_over_ban_count");
  });

  it("uses upsert to allow safe re-runs", () => {
    expect(carryOverRoute).toContain("upsert");
    expect(carryOverRoute).toContain("onConflict");
  });

  it("writes audit log with driver count", () => {
    expect(carryOverRoute).toContain("season.carry_over");
    expect(carryOverRoute).toContain("driver_count");
    expect(carryOverRoute).toContain("writeAdminAuditLog");
  });
});

// ---------------------------------------------------------------------------
// 4. User role management — super_admin only
// ---------------------------------------------------------------------------

describe("S8 user role schema", () => {
  it("accepts racer, admin, super_admin roles", () => {
    for (const role of ["racer", "admin", "super_admin"] as const) {
      expect(userRoleBodySchema.safeParse({ role }).success).toBe(true);
    }
  });

  it("rejects unknown roles", () => {
    expect(userRoleBodySchema.safeParse({ role: "moderator" }).success).toBe(false);
    expect(userRoleBodySchema.safeParse({ role: "" }).success).toBe(false);
  });
});

describe("S8 users list route", () => {
  it("uses withAdminGuard", () => {
    expect(usersRoute).toContain("withAdminGuard");
  });

  it("requires super_admin role", () => {
    expect(usersRoute).toContain("super_admin");
    expect(usersRoute).toContain("403");
  });
});

describe("S8 user role change route", () => {
  it("uses withAdminGuard", () => {
    expect(userRoleRoute).toContain("withAdminGuard");
  });

  it("requires super_admin role", () => {
    expect(userRoleRoute).toContain("super_admin");
    expect(userRoleRoute).toContain("403");
  });

  it("prevents a super_admin from changing their own role", () => {
    expect(userRoleRoute).toContain("Cannot change your own role");
    expect(userRoleRoute).toContain("auth.user.id");
  });

  it("writes audit log with before and after role", () => {
    expect(userRoleRoute).toContain("user.role_changed");
    expect(userRoleRoute).toContain("from");
    expect(userRoleRoute).toContain("writeAdminAuditLog");
  });
});

// ---------------------------------------------------------------------------
// 5. Audit log route
// ---------------------------------------------------------------------------

describe("S8 audit log route", () => {
  it("uses withAdminGuard", () => {
    expect(auditRoute).toContain("withAdminGuard");
  });

  it("limits results to MAX_AUDIT_LOGS_LIST", () => {
    expect(auditRoute).toContain("MAX_AUDIT_LOGS_LIST");
  });

  it("supports filtering by actor_id, action, entity_type, entity_id, and date range", () => {
    expect(auditRoute).toContain("actor_id");
    expect(auditRoute).toContain("action");
    expect(auditRoute).toContain("entity_type");
    expect(auditRoute).toContain("entity_id");
    expect(auditRoute).toContain("date_from");
    expect(auditRoute).toContain("date_to");
  });

  it("is read-only — no insert, update, or delete", () => {
    expect(auditRoute).not.toContain(".insert(");
    expect(auditRoute).not.toContain(".update(");
    expect(auditRoute).not.toContain(".delete(");
  });
});

// ---------------------------------------------------------------------------
// 6. S8 migration — audit logs remain append-only
// ---------------------------------------------------------------------------

describe("S8 migration", () => {
  it("adds is_archived column to seasons", () => {
    expect(s8Migration).toContain("is_archived");
    expect(s8Migration).toContain("seasons");
  });

  it("adds filtering indexes on audit_logs", () => {
    expect(s8Migration).toContain("audit_logs_actor_idx");
    expect(s8Migration).toContain("audit_logs_action_idx");
    expect(s8Migration).toContain("audit_logs_entity_idx");
  });

  it("does not add update or delete policies for audit_logs", () => {
    const lowerMigration = s8Migration.toLowerCase();
    expect(lowerMigration).not.toContain("for update");
    expect(lowerMigration).not.toContain("for delete");
  });
});
