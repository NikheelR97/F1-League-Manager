import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// M11: stewards had no way to record post-race point adjustments (bonuses,
// penalties, corrections) without SQL. These tests mirror the source-scan
// style used in penalty-status.test.ts / s10-security.test.ts for route-shape
// assertions that would otherwise need a full DB mock.

describe("adjustments POST route", () => {
  const routeSrc = readFileSync(
    "src/app/api/admin/leagues/[id]/adjustments/route.ts",
    "utf8",
  );

  it("restricts adjustment_kind to the DB enum", () => {
    expect(routeSrc).toContain('z.enum(["bonus", "penalty", "correction"])');
  });

  it("caps points_delta to the DB's -200..200 check constraint", () => {
    expect(routeSrc).toContain(".min(-200)");
    expect(routeSrc).toContain(".max(200)");
  });

  it("enforces exactly one of driver_id/team_id via refine (mirrors the DB one-target check)", () => {
    expect(routeSrc).toContain(".refine(");
    expect(routeSrc).toContain("Boolean(data.driver_id) !== Boolean(data.team_id)");
  });

  it("reuses recalculateStandings instead of duplicating recalculation logic", () => {
    expect(routeSrc).toContain("recalculateStandings(");
    expect(routeSrc).not.toContain("buildDriverStandings");
  });

  it("writes an audit log entry naming the created adjustment", () => {
    expect(routeSrc).toContain('action: "adjustment.created"');
    expect(routeSrc).toContain("entityType: \"championship_adjustment\"");
  });

  it("revalidates the standings cache tag after creating an adjustment", () => {
    expect(routeSrc).toContain("cacheTag.standings(leagueId)");
  });

  it("never returns applied_by/league_id/season_id in the response", () => {
    // Only the sanitized response object matters here — audit metadata and
    // the insert payload legitimately reference these fields elsewhere.
    expect(routeSrc).toContain(
      "{\n        id: created.id,\n        adjustment_kind: created.adjustment_kind,\n        points_delta: created.points_delta,\n        reason: created.reason,\n      },",
    );
  });
});

describe("adjustments DELETE route", () => {
  const routeSrc = readFileSync("src/app/api/admin/adjustments/[id]/route.ts", "utf8");

  it("validates the adjustment id as a UUID", () => {
    expect(routeSrc).toContain("z.string().uuid()");
  });

  it("reuses recalculateStandings instead of duplicating recalculation logic", () => {
    expect(routeSrc).toContain("recalculateStandings(");
    expect(routeSrc).not.toContain("buildDriverStandings");
  });

  it("writes an audit log entry naming the deleted adjustment", () => {
    expect(routeSrc).toContain('action: "adjustment.deleted"');
    expect(routeSrc).toContain("entityType: \"championship_adjustment\"");
  });

  it("revalidates the standings cache tag after deleting an adjustment", () => {
    expect(routeSrc).toContain("cacheTag.standings(adjustment.league_id)");
  });
});

describe("adjustment delete button", () => {
  const componentSrc = readFileSync(
    "src/components/admin/AdjustmentDeleteButton.tsx",
    "utf8",
  );

  it("gates deletion behind a native confirm naming the target", () => {
    const confirmIdx = componentSrc.indexOf("confirm(");
    const fetchIdx = componentSrc.indexOf("await fetch(");
    expect(confirmIdx).toBeGreaterThan(-1);
    expect(confirmIdx).toBeLessThan(fetchIdx);
    expect(componentSrc).toContain("Remove this adjustment for ${targetName}");
  });

  it("names the target in the button's aria-label", () => {
    expect(componentSrc).toContain("aria-label={`Delete adjustment for ${targetName}`}");
  });
});

describe("adjustment create form", () => {
  const componentSrc = readFileSync("src/components/admin/AdjustmentForm.tsx", "utf8");

  it("uses a single target select rather than two mutually-exclusive fields", () => {
    expect(componentSrc).toContain('values.target.split(":")');
  });

  it("labels the points field with the exact add/deduct semantics", () => {
    expect(componentSrc).toContain(
      "Points are added as entered — use a negative value to deduct.",
    );
  });
});
