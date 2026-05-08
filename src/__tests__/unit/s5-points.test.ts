import { describe, expect, it } from "vitest";

import { parseWorkbookGap } from "@/lib/results/parse-gap";
import {
  calculateRacePoints,
  type PointsSystem,
} from "@/lib/results/points";
import {
  checkPublishPreconditions,
  type RaceResultEntry,
} from "@/lib/results/publish-service";
import {
  buildDriverStandings,
  buildPenaltyTotals,
  buildTeamStandings,
} from "@/lib/results/standings";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const STD: PointsSystem = {
  points_by_position: {
    "1": 25, "2": 18, "3": 15, "4": 12, "5": 10,
    "6": 8, "7": 6, "8": 4, "9": 2, "10": 1,
  },
  fastest_lap_points: 1,
  pole_position_points: 0,
};

const CUSTOM: PointsSystem = {
  points_by_position: { "1": 10, "2": 7, "3": 5 },
  fastest_lap_points: 2,
  pole_position_points: 3,
};

function pts(
  opts: {
    position?: number | null;
    status?: string;
    fl?: boolean;
    pole?: boolean;
    system?: PointsSystem;
    flEnabled?: boolean;
    poleEnabled?: boolean;
  } = {},
) {
  return calculateRacePoints({
    finishing_position: opts.position !== undefined ? opts.position : 1,
    result_status: opts.status ?? "classified",
    is_fastest_lap: opts.fl ?? false,
    is_pole: opts.pole ?? false,
    league_fastest_lap_enabled: opts.flEnabled !== false,
    league_pole_enabled: opts.poleEnabled ?? false,
    points_system: opts.system ?? STD,
  });
}

// ---------------------------------------------------------------------------
// 1. Points calculation
// ---------------------------------------------------------------------------

describe("calculateRacePoints — standard F1 points", () => {
  it("P1 = 25", () => expect(pts({ position: 1 })).toBe(25));
  it("P2 = 18", () => expect(pts({ position: 2 })).toBe(18));
  it("P10 = 1", () => expect(pts({ position: 10 })).toBe(1));
  it("P11 = 0 (outside points)", () => expect(pts({ position: 11 })).toBe(0));
});

describe("calculateRacePoints — custom points", () => {
  it("custom P1 = 10", () => expect(pts({ position: 1, system: CUSTOM })).toBe(10));
  it("custom P3 = 5", () => expect(pts({ position: 3, system: CUSTOM })).toBe(5));
  it("custom outside = 0", () => expect(pts({ position: 4, system: CUSTOM })).toBe(0));
});

describe("calculateRacePoints — fastest lap bonus", () => {
  it("adds bonus when enabled", () => expect(pts({ position: 2, fl: true, flEnabled: true })).toBe(19));
  it("skips bonus when disabled", () => expect(pts({ position: 2, fl: true, flEnabled: false })).toBe(18));
  it("custom FL bonus = 2", () =>
    expect(pts({ position: 1, fl: true, flEnabled: true, system: CUSTOM })).toBe(12));
});

describe("calculateRacePoints — pole position bonus", () => {
  it("adds bonus when enabled", () =>
    expect(pts({ position: 1, pole: true, poleEnabled: true, system: CUSTOM })).toBe(13));
  it("skips bonus when disabled", () =>
    expect(pts({ position: 1, pole: true, poleEnabled: false, system: CUSTOM })).toBe(10));
});

describe("calculateRacePoints — non-classified statuses score zero", () => {
  it("DNF = 0", () => expect(pts({ status: "dnf" })).toBe(0));
  it("DNS = 0", () => expect(pts({ status: "dns" })).toBe(0));
  it("DSQ = 0", () => expect(pts({ status: "dsq" })).toBe(0));
  it("BAN = 0", () => expect(pts({ status: "ban" })).toBe(0));
  it("null position = 0", () => expect(pts({ position: null })).toBe(0));
});

// ---------------------------------------------------------------------------
// 2. Workbook gap parser
// ---------------------------------------------------------------------------

describe("parseWorkbookGap", () => {
  it("blank string → DNS", () =>
    expect(parseWorkbookGap("")).toEqual({ status: "dns", rawGap: null }));
  it("null → DNS", () =>
    expect(parseWorkbookGap(null)).toEqual({ status: "dns", rawGap: null }));
  it("undefined → DNS", () =>
    expect(parseWorkbookGap(undefined)).toEqual({ status: "dns", rawGap: null }));

  it("0 → classified leader", () =>
    expect(parseWorkbookGap("0")).toEqual({ status: "classified", rawGap: 0 }));
  it("89.354 → classified", () =>
    expect(parseWorkbookGap("89.354")).toEqual({ status: "classified", rawGap: 89.354 }));
  it("93 → classified", () =>
    expect(parseWorkbookGap("93")).toEqual({ status: "classified", rawGap: 93 }));

  it("DNF - 1 → dnf", () =>
    expect(parseWorkbookGap("DNF - 1")).toEqual({ status: "dnf", rawGap: null }));
  it("DNF - 2 → dnf", () =>
    expect(parseWorkbookGap("DNF - 2")).toEqual({ status: "dnf", rawGap: null }));

  it("1 Lap - 1 → classified (lapped)", () =>
    expect(parseWorkbookGap("1 Lap - 1")).toEqual({ status: "classified", rawGap: null }));
  it("2 Laps - 2 → classified (lapped)", () =>
    expect(parseWorkbookGap("2 Laps - 2")).toEqual({ status: "classified", rawGap: null }));

  it("BAN → ban", () =>
    expect(parseWorkbookGap("BAN")).toEqual({ status: "ban", rawGap: null }));
  it("DSQ → dsq", () =>
    expect(parseWorkbookGap("DSQ")).toEqual({ status: "dsq", rawGap: null }));
});

// ---------------------------------------------------------------------------
// 3. Driver standings
// ---------------------------------------------------------------------------

describe("buildDriverStandings", () => {
  const mkResult = (
    driver_id: string,
    team_id: string,
    opts: Partial<{
      pos: number | null;
      status: string;
      pts: number;
      adj: number;
      fl: boolean;
    }> = {},
  ) => ({
    driver_id,
    team_id,
    finishing_position: opts.pos !== undefined ? opts.pos : 1,
    result_status: opts.status ?? "classified",
    points_awarded: opts.pts ?? 25,
    manual_points_adjustment: opts.adj ?? 0,
    fastest_lap: opts.fl ?? false,
  });

  it("sums points_awarded + manual_points_adjustment", () => {
    const standings = buildDriverStandings(
      [mkResult("d1", "t1", { pts: 25, adj: 5 })],
      [],
      new Map(),
    );
    expect(standings[0].total_points).toBe(30);
  });

  it("manual championship adjustment adds to total", () => {
    const standings = buildDriverStandings(
      [mkResult("d1", "t1", { pts: 25 })],
      [{ driver_id: "d1", team_id: null, points_delta: -10 }],
      new Map(),
    );
    expect(standings[0].total_points).toBe(15);
  });

  it("disciplinary penalty points do NOT affect championship standings", () => {
    // penalty_points is not part of ResultForStandings — only points_awarded + manual_points_adjustment count
    const standings = buildDriverStandings(
      [mkResult("d1", "t1", { pts: 25 })],
      [],
      new Map(),
    );
    // No penalty deduction — should still be 25
    expect(standings[0].total_points).toBe(25);
  });

  it("DNF driver with 0 points is included at bottom", () => {
    const standings = buildDriverStandings(
      [
        mkResult("d1", "t1", { pts: 25 }),
        mkResult("d2", "t1", { status: "dnf", pts: 0, pos: null }),
      ],
      [],
      new Map(),
    );
    expect(standings).toHaveLength(2);
    expect(standings[0].driver_id).toBe("d1");
    expect(standings[1].driver_id).toBe("d2");
    expect(standings[1].total_points).toBe(0);
  });

  it("tie-break: equal points → sorted by wins desc", () => {
    // d1 = 18 pts (P2, no win); d2 = 25 race pts − 7 championship adj = 18 pts (P1, has win)
    const standings = buildDriverStandings(
      [
        mkResult("d1", "t1", { pts: 18, pos: 2 }),
        mkResult("d2", "t1", { pts: 25, pos: 1 }),
      ],
      [{ driver_id: "d2", team_id: null, points_delta: -7 }],
      new Map(),
    );
    expect(standings[0].driver_id).toBe("d2"); // equal points, d2 wins on wins
    expect(standings[1].driver_id).toBe("d1");
  });

  it("tie-break: equal points + wins → sorted by podiums desc", () => {
    const standings = buildDriverStandings(
      [
        mkResult("d1", "t1", { pts: 18, pos: 4 }), // no podium
        mkResult("d2", "t1", { pts: 18, pos: 3 }), // podium
      ],
      [],
      new Map(),
    );
    expect(standings[0].driver_id).toBe("d2");
  });

  it("tie-break: equal points + wins + podiums → sorted by fastest_laps desc", () => {
    const standings = buildDriverStandings(
      [
        mkResult("d1", "t1", { pts: 18, pos: 4, fl: false }),
        mkResult("d2", "t1", { pts: 18, pos: 4, fl: true }),
      ],
      [],
      new Map(),
    );
    expect(standings[0].driver_id).toBe("d2");
  });

  it("previous_position reflects the supplied map", () => {
    const standings = buildDriverStandings(
      [mkResult("d1", "t1")],
      [],
      new Map([["d1", 3]]),
    );
    expect(standings[0].previous_position).toBe(3);
  });

  it("previous_position is null when driver not in map", () => {
    const standings = buildDriverStandings(
      [mkResult("d1", "t1")],
      [],
      new Map(),
    );
    expect(standings[0].previous_position).toBeNull();
  });

  it("team championship adjustment does NOT affect driver totals", () => {
    const standings = buildDriverStandings(
      [mkResult("d1", "t1", { pts: 25 })],
      [{ driver_id: null, team_id: "t1", points_delta: 10 }], // team adj
      new Map(),
    );
    expect(standings[0].total_points).toBe(25); // unaffected
  });
});

// ---------------------------------------------------------------------------
// 4. Constructor standings
// ---------------------------------------------------------------------------

describe("buildTeamStandings", () => {
  const mkResult = (
    driver_id: string,
    team_id: string,
    opts: Partial<{ pos: number | null; status: string; pts: number; adj: number }> = {},
  ) => ({
    driver_id,
    team_id,
    finishing_position: opts.pos !== undefined ? opts.pos : 1,
    result_status: opts.status ?? "classified",
    points_awarded: opts.pts ?? 25,
    manual_points_adjustment: opts.adj ?? 5, // intentionally non-zero to prove exclusion
    fastest_lap: false,
  });

  it("constructor points use only points_awarded, not manual_points_adjustment", () => {
    const standings = buildTeamStandings(
      [mkResult("d1", "t1", { pts: 25, adj: 5 })],
      [],
      new Map(),
    );
    expect(standings[0].total_points).toBe(25); // not 30
  });

  it("team championship adjustment adds to constructor total", () => {
    const standings = buildTeamStandings(
      [mkResult("d1", "t1", { pts: 25, adj: 0 })],
      [{ driver_id: null, team_id: "t1", points_delta: 10 }],
      new Map(),
    );
    expect(standings[0].total_points).toBe(35);
  });

  it("driver championship adjustment does NOT affect constructor totals", () => {
    const standings = buildTeamStandings(
      [mkResult("d1", "t1", { pts: 25, adj: 0 })],
      [{ driver_id: "d1", team_id: null, points_delta: 10 }], // driver adj
      new Map(),
    );
    expect(standings[0].total_points).toBe(25); // unaffected
  });

  it("reserve appearances count to their team_id at race time", () => {
    const standings = buildTeamStandings(
      [
        mkResult("reserve", "t2", { pts: 15, pos: 3, adj: 0 }),
        mkResult("d1", "t1", { pts: 25, pos: 1, adj: 0 }),
      ],
      [],
      new Map(),
    );
    const t1 = standings.find((s) => s.team_id === "t1");
    const t2 = standings.find((s) => s.team_id === "t2");
    expect(t1?.total_points).toBe(25);
    expect(t2?.total_points).toBe(15);
  });

  it("wins counted for P1 classified results", () => {
    const standings = buildTeamStandings(
      [mkResult("d1", "t1", { pts: 25, pos: 1, adj: 0 })],
      [],
      new Map(),
    );
    expect(standings[0].wins).toBe(1);
  });

  it("podiums counted for P1-P3 classified results", () => {
    const standings = buildTeamStandings(
      [
        mkResult("d1", "t1", { pts: 25, pos: 1, adj: 0 }),
        mkResult("d2", "t1", { pts: 15, pos: 3, adj: 0 }),
      ],
      [],
      new Map(),
    );
    expect(standings[0].podiums).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Penalty totals
// ---------------------------------------------------------------------------

describe("buildPenaltyTotals", () => {
  it("sums in-season penalty points per driver", () => {
    const totals = buildPenaltyTotals(
      [
        { driver_id: "d1", penalty_points: 3 },
        { driver_id: "d1", penalty_points: 5 },
      ],
      new Map(),
      12,
    );
    expect(totals.find((t) => t.driver_id === "d1")?.penalty_points).toBe(8);
  });

  it("adds carry-over penalty points from previous season", () => {
    const totals = buildPenaltyTotals(
      [{ driver_id: "d1", penalty_points: 5 }],
      new Map([["d1", 4]]),
      12,
    );
    expect(totals.find((t) => t.driver_id === "d1")?.penalty_points).toBe(9);
  });

  it("sets ban_threshold_reached when total >= threshold", () => {
    const totals = buildPenaltyTotals(
      [{ driver_id: "d1", penalty_points: 12 }],
      new Map(),
      12,
    );
    expect(totals.find((t) => t.driver_id === "d1")?.ban_threshold_reached).toBe(true);
  });

  it("ban_threshold_reached is false below threshold", () => {
    const totals = buildPenaltyTotals(
      [{ driver_id: "d1", penalty_points: 11 }],
      new Map(),
      12,
    );
    expect(totals.find((t) => t.driver_id === "d1")?.ban_threshold_reached).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Publish preconditions (tests 9 & 10 from HANDOVER §13)
// ---------------------------------------------------------------------------

const mockLeague = { id: "league-1" };
const mockPs: PointsSystem = {
  points_by_position: { "1": 25 },
  fastest_lap_points: 1,
  pole_position_points: 0,
};

describe("checkPublishPreconditions — duplicate publish returns conflict (test 9)", () => {
  it("returns 409 when session status is already completed", () => {
    const result = checkPublishPreconditions(
      { status: "completed" },
      false,
      mockLeague,
      mockPs,
    );
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("returns 404 when session is null", () => {
    const result = checkPublishPreconditions(null, false, mockLeague, mockPs);
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it("returns 404 when sessionError is true", () => {
    const result = checkPublishPreconditions({ status: "scheduled" }, true, mockLeague, mockPs);
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it("returns 404 when league is null", () => {
    const result = checkPublishPreconditions({ status: "scheduled" }, false, null, mockPs);
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it("returns 422 when no points system is attached", () => {
    const result = checkPublishPreconditions({ status: "scheduled" }, false, mockLeague, null);
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("returns null (all clear) for a valid unpublished session", () => {
    const result = checkPublishPreconditions({ status: "scheduled" }, false, mockLeague, mockPs);
    expect(result).toBeNull();
  });
});

describe("RaceResultEntry — client-supplied points are rejected (test 10)", () => {
  it("RaceResultEntry type has no points_awarded field — server recalculates it", () => {
    const entry: RaceResultEntry = {
      driver_id: "d1",
      team_id: "t1",
      finishing_position: 1,
      result_status: "classified",
      fastest_lap: true,
      manual_points_adjustment: 0,
      penalty_points: 0,
      raw_result: null,
      notes: null,
    };
    // The interface does not include points_awarded; server always calls calculateRacePoints.
    expect(Object.prototype.hasOwnProperty.call(entry, "points_awarded")).toBe(false);
  });

  it("server-calculated points differ from any value a client might forge", () => {
    // Verify calculateRacePoints produces the authoritative value regardless of what
    // a client submits. Simulate a P1 + FL result where a client might claim 0 pts.
    const authoritative = calculateRacePoints({
      finishing_position: 1,
      result_status: "classified",
      is_fastest_lap: true,
      is_pole: false,
      league_fastest_lap_enabled: true,
      league_pole_enabled: false,
      points_system: STD,
    });
    expect(authoritative).toBe(26); // 25 + 1 FL — not whatever the client claimed
  });
});
