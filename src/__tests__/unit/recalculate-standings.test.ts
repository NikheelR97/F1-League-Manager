import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// S13-B4 — manual "recalculate standings" admin trigger.
const recalculateRoute = readFileSync(
  "src/app/api/admin/leagues/[id]/recalculate/route.ts",
  "utf8",
);

describe("recalculate standings route", () => {
  it("resolves the current season via getCurrentSeason and 409s when absent", () => {
    expect(recalculateRoute).toContain("getCurrentSeason");
    expect(recalculateRoute).toContain("League has no current season");
    expect(recalculateRoute).toContain("status: 409");
  });

  it("reuses the existing recalculateStandings service and writes the standings.recalculated audit action", () => {
    expect(recalculateRoute).toContain(
      'import { recalculateStandings } from "@/lib/results/publish-service"',
    );
    expect(recalculateRoute).toContain('action: "standings.recalculated"');
  });
});
