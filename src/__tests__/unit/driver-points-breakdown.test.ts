import { describe, expect, it } from "vitest";

import {
  buildDriverPointsBreakdown,
  buildTeamStandings,
  type ResultForStandings,
} from "@/lib/results/standings";

// The team page's "Driver Points Breakdown" must reconcile with the header's
// constructor total. Both sum points_awarded + manual_points_adjustment, so a
// race-day adjustment (e.g. a per-race points cap) lands on driver and team.

describe("buildDriverPointsBreakdown", () => {
  it("includes manual_points_adjustment", () => {
    const breakdown = buildDriverPointsBreakdown([
      {
        driver_id: "d1",
        driver_name: "Driver One",
        points_awarded: 25,
        manual_points_adjustment: -7,
      },
    ]);

    expect(breakdown).toEqual([{ driver_id: "d1", name: "Driver One", points: 18 }]);
  });

  it("sums a driver's points across multiple sessions, adjustments included", () => {
    const breakdown = buildDriverPointsBreakdown([
      { driver_id: "d1", driver_name: "Driver One", points_awarded: 25, manual_points_adjustment: 5 },
      { driver_id: "d1", driver_name: "Driver One", points_awarded: 18, manual_points_adjustment: -3 },
    ]);

    expect(breakdown).toEqual([{ driver_id: "d1", name: "Driver One", points: 45 }]);
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
    expect(breakdownSum).toBe(46); // 25 + 5 + 18 - 2, adjustments in both
  });
});
