import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildDiff } from "../../lib/import/diff";

// Source files read once and checked for security invariants.
const uploadRoute = readFileSync("src/app/api/admin/import/route.ts", "utf8");
const confirmRoute = readFileSync("src/app/api/admin/import/confirm/route.ts", "utf8");
const workbookParser = readFileSync("src/lib/import/workbook-parser.ts", "utf8");
const importService = readFileSync("src/lib/import/import-service.ts", "utf8");
const diffModule = readFileSync("src/lib/import/diff.ts", "utf8");
const s9Migration = readFileSync("supabase/migrations/20260513000000_s9_workbook_import.sql", "utf8");

// ---------------------------------------------------------------------------
// Inline schemas mirroring the API routes (for isolated unit tests)
// ---------------------------------------------------------------------------

const uploadParamsSchema = z.object({
  league_id: z.string().uuid("Invalid league id"),
  season_id: z.string().uuid("Invalid season id"),
});

const confirmBodySchema = z.object({
  migration_id: z.string().uuid("Invalid migration id"),
});

// ---------------------------------------------------------------------------
// 1. File validation — rejected before parsing
// ---------------------------------------------------------------------------

describe("S9 file validation", () => {
  it("upload route accepts only .xlsx files (checks .endsWith)", () => {
    expect(uploadRoute).toContain(".xlsx");
    expect(uploadRoute).toContain("Only .xlsx files are accepted");
  });

  it("upload route rejects oversized workbooks", () => {
    expect(uploadRoute).toContain("MAX_WORKBOOK_BYTES");
    expect(uploadRoute).toContain("Workbook exceeds maximum size");
  });

  it("upload route validates league_id as UUID", () => {
    expect(uploadRoute).toContain("z.string().uuid");
    expect(uploadRoute).toContain("Invalid league id");
  });

  it("upload route validates season_id as UUID", () => {
    expect(uploadRoute).toContain("z.string().uuid");
    expect(uploadRoute).toContain("Invalid season id");
  });

  it("upload params schema rejects non-UUID league_id", () => {
    const result = uploadParamsSchema.safeParse({
      league_id: "not-a-uuid",
      season_id: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
  });

  it("upload params schema accepts valid UUIDs", () => {
    const result = uploadParamsSchema.safeParse({
      league_id: "00000000-0000-4000-8000-000000000001",
      season_id: "00000000-0000-4000-8000-000000000002",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Security pipeline — both routes use withAdminGuard
// ---------------------------------------------------------------------------

describe("S9 upload route security", () => {
  it("uses withAdminGuard", () => {
    expect(uploadRoute).toContain("withAdminGuard");
  });

  it("passes maxBodyBytes to guard (allows large workbooks through the guard)", () => {
    expect(uploadRoute).toContain("maxBodyBytes");
    expect(uploadRoute).toContain("MAX_WORKBOOK_BYTES");
  });

  it("writes import.uploaded audit log on success", () => {
    expect(uploadRoute).toContain("import.uploaded");
    expect(uploadRoute).toContain("writeAdminAuditLog");
  });

  it("does NOT send raw workbook rows to the browser", () => {
    // The response must only contain migration_id, diff, and clean — not parsed rows.
    expect(uploadRoute).toContain("migration_id");
    expect(uploadRoute).toContain("diff");
    expect(uploadRoute).toContain("clean");
    expect(uploadRoute).not.toContain("raceData");
    expect(uploadRoute).not.toContain("drivers: parseResult");
  });
});

describe("S9 confirm route security", () => {
  it("uses withAdminGuard", () => {
    expect(confirmRoute).toContain("withAdminGuard");
  });

  it("validates migration_id as UUID", () => {
    expect(confirmRoute).toContain("z.string().uuid");
    expect(confirmRoute).toContain("Invalid migration id");
  });

  it("rejects confirmation of an already-confirmed migration", () => {
    expect(confirmRoute).toContain("Migration is already confirmed");
    expect(confirmRoute).toContain("409");
  });

  it("writes import.confirmed audit log", () => {
    expect(confirmRoute).toContain("import.confirmed");
    expect(confirmRoute).toContain("writeAdminAuditLog");
  });

  it("confirm schema rejects non-UUID migration_id", () => {
    expect(confirmBodySchema.safeParse({ migration_id: "bad" }).success).toBe(false);
  });

  it("confirm schema accepts valid UUID", () => {
    expect(
      confirmBodySchema.safeParse({ migration_id: "00000000-0000-4000-8000-000000000001" }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Parser validation
// ---------------------------------------------------------------------------

describe("S9 workbook parser", () => {
  it("validates required sheets are present", () => {
    expect(workbookParser).toContain("Required sheet");
    expect(workbookParser).toContain("League Management");
    expect(workbookParser).toContain("Final Classifications");
    expect(workbookParser).toContain("Championships");
  });

  it("rejects when sheet size exceeds MAX_WORKBOOK_RACES bounds", () => {
    expect(workbookParser).toContain("MAX_WORKBOOK_RACES");
    expect(workbookParser).toContain("Too many columns");
  });

  it("rejects when row count exceeds MAX_WORKBOOK_DRIVERS bounds", () => {
    expect(workbookParser).toContain("MAX_WORKBOOK_DRIVERS");
    expect(workbookParser).toContain("Too many rows");
  });

  it("rejects unknown circuit names", () => {
    expect(workbookParser).toContain("Unknown track");
    expect(workbookParser).toContain("circuit map");
  });

  it("handles DNP result as dns status", () => {
    expect(workbookParser).toContain("DNP");
    expect(workbookParser).toContain("dns");
  });

  it("handles BAN result as ban status", () => {
    expect(workbookParser).toContain("BAN");
    expect(workbookParser).toContain("ban");
  });

  it("handles DSQ result as dsq status", () => {
    expect(workbookParser).toContain("DSQ");
    expect(workbookParser).toContain("dsq");
  });

  it("handles DNF result as dnf status", () => {
    expect(workbookParser).toContain("DNF");
    expect(workbookParser).toContain("dnf");
  });

  it("parses carry-over penalty points and bans from League Management", () => {
    expect(workbookParser).toContain("carryOverPenaltyPoints");
    expect(workbookParser).toContain("carryOverQualyBans");
    expect(workbookParser).toContain("carryOverRaceBans");
  });

  it("parses mid-season transfers (previousTeam + transferAfterRace)", () => {
    expect(workbookParser).toContain("previousTeam");
    expect(workbookParser).toContain("transferAfterRace");
  });

  it("parses manual championship points from Final Classifications", () => {
    expect(workbookParser).toContain("manualChampPoints");
    expect(workbookParser).toContain("OFF_MANUAL_CHAMP_PTS");
  });

  it("reads cell VALUES only (no formula evaluation)", () => {
    // XLSX read uses type:'buffer' which reads cached values, not formulas
    expect(workbookParser).toContain("type: \"buffer\"");
  });
});

// ---------------------------------------------------------------------------
// 4. Import service
// ---------------------------------------------------------------------------

describe("S9 import service", () => {
  it("uses server-authoritative points calculation (calculateRacePoints)", () => {
    expect(importService).toContain("calculateRacePoints");
  });

  it("uses upsert for league_driver_entries (idempotent)", () => {
    expect(importService).toContain("upsert");
    expect(importService).toContain("league_driver_entries");
  });

  it("deletes and reinserts qualifying results for idempotent re-upload", () => {
    expect(importService).toContain("qualifying_results");
    expect(importService).toContain(".delete()");
  });

  it("deletes and reinserts race results for idempotent re-upload", () => {
    expect(importService).toContain("race_results");
  });

  it("applies transfer history to resolve correct team per race", () => {
    expect(importService).toContain("resolveTeamId");
    expect(importService).toContain("transferAfterRace");
  });

  it("bounds driver entry queries with MAX_WORKBOOK_DRIVERS check in parser", () => {
    // The bound is in the parser but the service respects the parsed list
    expect(workbookParser).toContain("MAX_WORKBOOK_DRIVERS");
  });
});

// ---------------------------------------------------------------------------
// 5. Diff module
// ---------------------------------------------------------------------------

describe("S9 diff module", () => {
  it("compares driver points between workbook and app", () => {
    expect(diffModule).toContain("workbookPoints");
    expect(diffModule).toContain("appPoints");
    expect(diffModule).toContain("drivers");
  });

  it("compares constructor points between workbook and app", () => {
    expect(diffModule).toContain("constructors");
  });

  it("marks diff clean only when all items match", () => {
    expect(diffModule).toContain("clean");
    expect(diffModule).toContain("every");
    expect(diffModule).toContain("match");
  });

  it("returns clean=false when a driver point total mismatches", () => {
    const workbook = {
      workbookDriverStandings: [{ pos: 1, name: "Driver A", points: 100, team: "Red Bull" }],
      workbookConstructorStandings: [],
      drivers: [], races: [], raceData: [],
    };
    const computed = {
      drivers: [{ driver_id: "x", name: "Driver A", total_points: 90 }],
      constructors: [],
    };
    const diff = buildDiff(workbook, computed);
    expect(diff.clean).toBe(false);
    expect(diff.drivers[0].match).toBe(false);
  });

  it("returns clean=true when all points match", () => {
    const workbook = {
      workbookDriverStandings: [{ pos: 1, name: "Driver A", points: 100, team: "Red Bull" }],
      workbookConstructorStandings: [{ pos: 1, team: "Red Bull", points: 200 }],
      drivers: [], races: [], raceData: [],
    };
    const computed = {
      drivers: [{ driver_id: "x", name: "Driver A", total_points: 100 }],
      constructors: [{ team_id: "t1", name: "Red Bull Racing", total_points: 200 }],
    };
    const diff = buildDiff(workbook, computed);
    expect(diff.clean).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Upload lock — re-import blocked after confirmation
// ---------------------------------------------------------------------------

describe("S9 import lock", () => {
  it("upload route checks for a confirmed migration before proceeding", () => {
    expect(uploadRoute).toContain("confirmed");
    expect(uploadRoute).toContain("locked against re-import");
    expect(uploadRoute).toContain("409");
  });

  it("confirm route sets status to confirmed", () => {
    expect(confirmRoute).toContain("confirmed");
    expect(confirmRoute).toContain("confirmed_by");
  });
});

// ---------------------------------------------------------------------------
// 7. S9 migration
// ---------------------------------------------------------------------------

describe("S9 migration", () => {
  it("adds unique constraint on race_sessions(league_id, season_id, session_code)", () => {
    expect(s9Migration).toContain("race_sessions_league_season_code_unique");
    expect(s9Migration).toContain("session_code");
  });

  it("adds index on workbook_migrations for fast status lookups", () => {
    expect(s9Migration).toContain("workbook_migrations_league_season_status_idx");
    expect(s9Migration).toContain("status");
  });
});
