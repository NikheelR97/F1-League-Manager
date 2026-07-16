import { describe, expect, it } from "vitest";

import {
  buildDriverPointsBreakdown,
  buildTeamStandings,
  type ResultForStandings,
} from "@/lib/results/standings";

// F1 — regression test for the team page's "Driver Points Breakdown" no
// longer reconciling with the header's constructor total. Pre-fix, the page
// summed `points_awarded + manual_points_adjustment` per driver while
// team_standings.total_points (buildTeamStandings) sums points_awarded only
// — any session with a non-zero manual adjustment made the breakdown rows
// overshoot the header total. The fix extracts the breakdown aggregation
// into buildDriverPointsBreakdown, which (like buildTeamStandings) uses
// points_awarded only.

describe("buildDriverPointsBreakdown", () => {
  it("ignores manual_points_adjustment even though it's present on the row", () => {
    const breakdown = buildDriverPointsBreakdown([
      {
        driver_id: "d1",
        driver_name: "Driver One",
        points_awarded: 25,
        manual_points_adjustment: 5, // intentionally non-zero to prove exclusion
      },
    ]);

    expect(breakdown).toEqual([{ driver_id: "d1", name: "Driver One", points: 25 }]);
  });

  it("sums a driver's points across multiple sessions, adjustments excluded", () => {
    const breakdown = buildDriverPointsBreakdown([
      { driver_id: "d1", driver_name: "Driver One", points_awarded: 25, manual_points_adjustment: 5 },
      { driver_id: "d1", driver_name: "Driver One", points_awarded: 18, manual_points_adjustment: -3 },
    ]);

    expect(breakdown).toEqual([{ driver_id: "d1", name: "Driver One", points: 43 }]);
  });

  it("sorts drivers by points descending", () => {
    const breakdown = buildDriverPointsBreakdown([
      { driver_id: "d1", driver_name: "Driver One", points_awarded: 10, manual_points_adjustment: 0 },
      { driver_id: "d2", driver_name: "Driver Two", points_awarded: 25, manual_points_adjustment: 0 },
    ]);

    expect(breakdown.map((d) => d.driver_id)).toEqual(["d2", "d1"]);
  });

  it("the summed breakdown reconciles exactly with the constructor total from buildTeamStandings", () => {
    // Two drivers on the same team, each with a non-zero manual adjustment —
    // the scenario that exposed the pre-fix bug (a per-race adjustment made
    // the driver breakdown sum drift above the team's header total).
    const results: ResultForStandings[] = [
      {
        driver_id: "d1",
        team_id: "t1",
        finishing_position: 1,
        result_status: "classified",
        points_awarded: 25,
        manual_points_adjustment: 5,
        fastest_lap: false,
      },
      {
        driver_id: "d2",
        team_id: "t1",
        finishing_position: 2,
        result_status: "classified",
        points_awarded: 18,
        manual_points_adjustment: -2,
        fastest_lap: false,
      },
    ];

    const teamStandings = buildTeamStandings(results, [], new Map());
    const breakdown = buildDriverPointsBreakdown(
      results.map((r) => ({
        driver_id: r.driver_id,
        driver_name: r.driver_id,
        points_awarded: r.points_awarded,
        manual_points_adjustment: r.manual_points_adjustment,
      })),
    );

    const breakdownSum = breakdown.reduce((sum, d) => sum + d.points, 0);
    expect(breakdownSum).toBe(teamStandings.find((s) => s.team_id === "t1")!.total_points);
    expect(breakdownSum).toBe(43); // 25 + 18, adjustments excluded from both
  });
});
