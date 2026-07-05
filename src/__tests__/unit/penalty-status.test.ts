import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { recalculateStandings } from "@/lib/results/publish-service";

// B4: admins had no post-publish path to rescind/appeal a penalty. These tests
// cover the new PATCH route + row editor without standing up a live Supabase
// instance, mirroring the source-scan style used in s10-security.test.ts for
// route-shape assertions that would otherwise need a full DB mock.

describe("recalculateStandings is reusable outside publishSession", () => {
  it("is exported as a function so the penalty-status route can reuse it", () => {
    expect(typeof recalculateStandings).toBe("function");
  });
});

describe("penalty status PATCH route", () => {
  const routeSrc = readFileSync("src/app/api/admin/penalties/[id]/route.ts", "utf8");

  it("validates the penalty id as a UUID", () => {
    expect(routeSrc).toContain("z.string().uuid()");
  });

  it("restricts status to the penalty_status enum", () => {
    expect(routeSrc).toContain('z.enum(["open", "served", "appealed", "rescinded"])');
  });

  it("reuses recalculateStandings instead of duplicating recalculation logic", () => {
    expect(routeSrc).toContain("recalculateStandings(");
    expect(routeSrc).not.toContain("buildPenaltyTotals");
  });

  it("writes an audit log entry naming the status transition", () => {
    expect(routeSrc).toContain('action: "penalty.status_changed"');
    expect(routeSrc).toContain("from: previousStatus");
    expect(routeSrc).toContain("to: body.status");
  });

  it("never returns steward_notes or appeal_notes in the response", () => {
    // Only the sanitized response line matters here — a code comment nearby
    // may legitimately name these fields to explain why they're absent.
    const responseLine = routeSrc
      .split("\n")
      .find((line) => line.includes("Response.json({ id: updated.id"));
    expect(responseLine).toBeDefined();
    expect(responseLine).not.toContain("steward_notes");
    expect(responseLine).not.toContain("appeal_notes");
  });

  it("revalidates standings and penalties cache tags after a status change", () => {
    expect(routeSrc).toContain("cacheTag.standings(penalty.league_id)");
    expect(routeSrc).toContain("cacheTag.penalties(penalty.league_id)");
  });
});

describe("penalty status row editor", () => {
  const componentSrc = readFileSync(
    "src/components/admin/PenaltyStatusEditor.tsx",
    "utf8",
  );

  it("gates rescind transitions behind a native confirm", () => {
    const confirmIdx = componentSrc.indexOf("window.confirm(");
    const fetchIdx = componentSrc.indexOf("await fetch(");
    expect(confirmIdx).toBeGreaterThan(-1);
    expect(confirmIdx).toBeLessThan(fetchIdx);
    expect(componentSrc).toContain('status === "rescinded"');
  });

  it("names the driver in the status select's aria-label", () => {
    expect(componentSrc).toContain("aria-label={`Penalty status for ${driverName}`}");
  });

  it("disables save until the status actually changes", () => {
    expect(componentSrc).toContain("disabled={!dirty || saveState === \"loading\"}");
  });
});
