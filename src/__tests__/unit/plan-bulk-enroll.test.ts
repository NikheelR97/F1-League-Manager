import { describe, expect, it } from "vitest";

import { planBulkEnroll, type EnrollRow, type PlanInput } from "@/lib/drivers/plan-bulk-enroll";

const row = (overrides: Partial<EnrollRow> = {}): EnrollRow => ({
  display_name: "Max Verstappen",
  racing_number: null,
  team_id: null,
  is_reserve: false,
  ...overrides,
});

const baseInput = (rows: EnrollRow[], overrides: Partial<PlanInput> = {}): PlanInput => ({
  rows,
  enrolledNamesLower: new Set(),
  existingPrimaryCountByTeam: new Map(),
  teamNameById: new Map(),
  maxPrimaryPerTeam: 2,
  ...overrides,
});

describe("planBulkEnroll", () => {
  it("dedupes case-insensitively within the batch, keeping the first", () => {
    const rows = [row({ display_name: "Max Verstappen" }), row({ display_name: "max verstappen" })];
    const result = planBulkEnroll(baseInput(rows));
    expect(result.toEnroll.map((r) => r.display_name)).toEqual(["Max Verstappen"]);
    expect(result.duplicateInBatch).toEqual(["max verstappen"]);
  });

  it("skips names already enrolled in the league", () => {
    const rows = [row({ display_name: "Lewis Hamilton" })];
    const result = planBulkEnroll(baseInput(rows, { enrolledNamesLower: new Set(["lewis hamilton"]) }));
    expect(result.toEnroll).toEqual([]);
    expect(result.skippedAlreadyEnrolled).toEqual(["Lewis Hamilton"]);
  });

  it("flags a team overflow when 2 existing + 1 new primary exceeds the cap", () => {
    const rows = [row({ display_name: "New Driver", team_id: "team-1", is_reserve: false })];
    const input = baseInput(rows, {
      existingPrimaryCountByTeam: new Map([["team-1", 2]]),
      teamNameById: new Map([["team-1", "Red Bull"]]),
    });
    const result = planBulkEnroll(input);
    expect(result.teamOverflows).toEqual([{ team_id: "team-1", team_name: "Red Bull", attempted: 3, cap: 2 }]);
    expect(result.toEnroll.map((r) => r.display_name)).toEqual(["New Driver"]);
  });

  it("excludes reserves from the per-team cap", () => {
    const rows = [
      row({ display_name: "Reserve One", team_id: "team-1", is_reserve: true }),
      row({ display_name: "Reserve Two", team_id: "team-1", is_reserve: true }),
    ];
    const input = baseInput(rows, { existingPrimaryCountByTeam: new Map([["team-1", 2]]) });
    const result = planBulkEnroll(input);
    expect(result.teamOverflows).toEqual([]);
  });

  it("excludes free agents (null team_id) from the per-team cap", () => {
    const rows = [row({ display_name: "Free Agent", team_id: null, is_reserve: false })];
    const result = planBulkEnroll(baseInput(rows));
    expect(result.teamOverflows).toEqual([]);
    expect(result.toEnroll.map((r) => r.display_name)).toEqual(["Free Agent"]);
  });

  it("ignores rows with an empty or whitespace-only display_name", () => {
    const rows = [row({ display_name: "   " }), row({ display_name: "" }), row({ display_name: "Valid Name" })];
    const result = planBulkEnroll(baseInput(rows));
    expect(result.toEnroll.map((r) => r.display_name)).toEqual(["Valid Name"]);
    expect(result.duplicateInBatch).toEqual([]);
    expect(result.skippedAlreadyEnrolled).toEqual([]);
  });
});
