import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseWorkbookGap } from "@/lib/results/parse-gap";
import {
  calculateRacePoints,
  type PointsSystem,
} from "@/lib/results/points";
import {
  buildReserveAssignmentRows,
  checkPublishPreconditions,
  computeSessionPenaltyTotals,
  filterPublishedResults,
  resolveStintForDate,
  validatePublishResults,
  type PenaltyEntry,
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

  // M4 — a free-agent result (team_id null) must never roll up into any
  // constructor's total; it's excluded entirely rather than creating a
  // standings row keyed by null.
  it("excludes free-agent results (team_id null) from every constructor total", () => {
    const standings = buildTeamStandings(
      [
        { ...mkResult("d1", "t1", { pts: 25, pos: 1, adj: 0 }) },
        { ...mkResult("d2", "t1", { pts: 18, pos: 2, adj: 0 }), team_id: null },
      ],
      [],
      new Map(),
    );
    expect(standings).toHaveLength(1);
    expect(standings[0].team_id).toBe("t1");
    expect(standings[0].total_points).toBe(25); // d2's 18 pts never counted anywhere
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

describe("computeSessionPenaltyTotals — race_results.penalty_points is server-derived (B1)", () => {
  const mkPenalty = (
    driver_id: string,
    penalty_points: number,
    status: PenaltyEntry["status"] = "open",
  ): PenaltyEntry => ({
    driver_id,
    penalty_points,
    reason: "test",
    status,
    steward_notes: null,
    appeal_notes: null,
  });

  it("sums formal penalties per driver for this session", () => {
    const totals = computeSessionPenaltyTotals([mkPenalty("d1", 3), mkPenalty("d1", 5)]);
    expect(totals.get("d1")).toBe(8);
  });

  it("excludes rescinded penalties", () => {
    const totals = computeSessionPenaltyTotals([mkPenalty("d1", 10, "rescinded")]);
    expect(totals.get("d1")).toBeUndefined();
  });

  it("a driver with no penalties has no entry", () => {
    const totals = computeSessionPenaltyTotals([mkPenalty("d1", 3)]);
    expect(totals.get("d2")).toBeUndefined();
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

describe("checkPublishPreconditions — republish (M9 correction path)", () => {
  it("still returns 409 for a completed session when republish is not set", () => {
    const result = checkPublishPreconditions({ status: "completed" }, false, mockLeague, mockPs);
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("returns null for a completed session when republish is true", () => {
    const result = checkPublishPreconditions(
      { status: "completed" },
      false,
      mockLeague,
      mockPs,
      true,
    );
    expect(result).toBeNull();
  });

  it("republish=true has no effect on a non-completed session", () => {
    const result = checkPublishPreconditions(
      { status: "scheduled" },
      false,
      mockLeague,
      mockPs,
      true,
    );
    expect(result).toBeNull();
  });
});

describe("validatePublishResults — server-side cross-field validation (test 10)", () => {
  const base: RaceResultEntry = {
    driver_id: "d1",
    team_id: "t1",
    finishing_position: 1,
    result_status: "classified",
    fastest_lap: false,
    manual_points_adjustment: 0,
    raw_result: null,
    notes: null,
  };

  it("returns null when results are valid", () => {
    expect(validatePublishResults([base])).toBeNull();
  });

  it("returns 422 when no driver is classified with a position", () => {
    const result = validatePublishResults([{ ...base, result_status: "dnf", finishing_position: null }]);
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("returns 422 for duplicate classified finishing positions", () => {
    const result = validatePublishResults([
      { ...base, driver_id: "d1", finishing_position: 1 },
      { ...base, driver_id: "d2", finishing_position: 1 },
    ]);
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("returns 422 when more than one driver has fastest_lap", () => {
    const result = validatePublishResults([
      { ...base, driver_id: "d1", finishing_position: 1, fastest_lap: true },
      { ...base, driver_id: "d2", finishing_position: 2, fastest_lap: true },
    ]);
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("allows a single fastest_lap driver", () => {
    const result = validatePublishResults([
      { ...base, driver_id: "d1", finishing_position: 1, fastest_lap: true },
      { ...base, driver_id: "d2", finishing_position: 2, fastest_lap: false },
    ]);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Team-as-of-date resolution (M7 — historical sessions must not prefill a
//    driver's present-day team when an intervening transfer moved them).
// ---------------------------------------------------------------------------

describe("resolveStintForDate", () => {
  const stints = [
    { starts_on: "2026-01-01", ends_on: "2026-03-01", team_id: "old-team" },
    { starts_on: "2026-03-01", ends_on: null, team_id: "new-team" },
  ];

  it("returns the stint whose [starts_on, ends_on) range contains the date", () => {
    expect(resolveStintForDate(stints, "2026-02-01")?.team_id).toBe("old-team");
  });

  it("ends_on is exclusive — the transfer date itself belongs to the new stint", () => {
    expect(resolveStintForDate(stints, "2026-03-01")?.team_id).toBe("new-team");
  });

  it("falls back to the still-active (ends_on null) stint when no range matches", () => {
    const gappy = [
      { starts_on: "2026-01-01", ends_on: "2026-02-01", team_id: "old-team" },
      { starts_on: "2026-03-01", ends_on: null, team_id: "new-team" },
    ];
    // 2026-02-15 falls in the gap between stints — no range matches.
    expect(resolveStintForDate(gappy, "2026-02-15")?.team_id).toBe("new-team");
  });

  it("falls back to any stint when none is active and none matches", () => {
    const allEnded = [{ starts_on: "2026-01-01", ends_on: "2026-02-01", team_id: "only-team" }];
    expect(resolveStintForDate(allEnded, "2026-05-01")?.team_id).toBe("only-team");
  });

  it("returns undefined for an empty stint list", () => {
    expect(resolveStintForDate([], "2026-05-01")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Reserve assignment rows (B7 — reserve coverage becomes a visible record)
// ---------------------------------------------------------------------------

describe("buildReserveAssignmentRows", () => {
  const base: RaceResultEntry = {
    driver_id: "reserve-1",
    team_id: "team-1",
    finishing_position: 5,
    result_status: "classified",
    fastest_lap: false,
    manual_points_adjustment: 0,
    raw_result: null,
    notes: null,
  };

  it("writes a row for a reserve driver's result naming who they covered for", () => {
    const rows = buildReserveAssignmentRows(
      [{ ...base, covering_for_driver_id: "primary-1" }],
      "session-1",
      "actor-1",
    );
    expect(rows).toEqual([
      {
        race_session_id: "session-1",
        original_driver_id: "primary-1",
        reserve_driver_id: "reserve-1",
        team_id: "team-1",
        assigned_by: "actor-1",
      },
    ]);
  });

  it("skips rows with no covering_for_driver_id — never blocks publish over it", () => {
    const rows = buildReserveAssignmentRows(
      [base, { ...base, driver_id: "d2", covering_for_driver_id: null }],
      "session-1",
      "actor-1",
    );
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 9. Penalty write idempotency on republish (X1 — a plain insert with no
//    preceding delete double-counts penalty points into ban thresholds and
//    standings on every republish of a session that carries penalties).
// ---------------------------------------------------------------------------

const publishServiceSource = readFileSync("src/lib/results/publish-service.ts", "utf8");
const penaltyDeleteChain = /\.from\("penalties"\)\s*\.delete\(\)\s*\.eq\("race_session_id",\s*sessionId\)/;
const reserveDeleteChain =
  /\.from\("race_reserve_assignments"\)\s*\.delete\(\)\s*\.eq\("race_session_id",\s*sessionId\)/;

describe("publishSession — penalty writes are delete-then-insert per session (X1)", () => {
  it("deletes existing penalties for the session before inserting new ones", () => {
    const deleteMatch = publishServiceSource.match(penaltyDeleteChain);
    const insertIdx = publishServiceSource.lastIndexOf('db.from("penalties").insert(');
    expect(deleteMatch).not.toBeNull();
    expect(insertIdx).toBeGreaterThan(-1);
    expect(deleteMatch!.index!).toBeLessThan(insertIdx);
  });

  it("mirrors the same idempotency pattern already used for reserve assignments", () => {
    expect(publishServiceSource).toMatch(reserveDeleteChain);
    expect(publishServiceSource).toMatch(penaltyDeleteChain);
  });
});

// ---------------------------------------------------------------------------
// 9b. Position-write idempotency on republish (F6 — qualifying_results and
//     race_results both carry a unique(session, position); a plain positions-
//     in-place upsert 500s when a correction swaps two drivers' positions,
//     because a row transiently collides with another row's old position.
//     Delete-then-insert per session removes the pre-existing rows to collide
//     with. Guards the fix at unit speed; e2e T2 proves it end-to-end.)
// ---------------------------------------------------------------------------

const qualifyingDeleteChain =
  /\.from\("qualifying_results"\)\s*\.delete\(\)\s*\.eq\("race_session_id",\s*sessionId\)/;
const raceResultsDeleteChain =
  /\.from\("race_results"\)\s*\.delete\(\)\s*\.eq\("race_session_id",\s*sessionId\)/;

describe("publishSession — position writes are delete-then-insert per session (F6)", () => {
  it("deletes qualifying_results before inserting, and never upserts them in place", () => {
    const deleteMatch = publishServiceSource.match(qualifyingDeleteChain);
    const insertIdx = publishServiceSource.indexOf('.from("qualifying_results").insert(');
    expect(deleteMatch).not.toBeNull();
    expect(insertIdx).toBeGreaterThan(-1);
    expect(deleteMatch!.index!).toBeLessThan(insertIdx);
    expect(publishServiceSource).not.toMatch(/\.from\("qualifying_results"\)\s*\.upsert/);
  });

  it("deletes race_results before inserting, and never upserts them in place", () => {
    const deleteMatch = publishServiceSource.match(raceResultsDeleteChain);
    const insertIdx = publishServiceSource.indexOf('.from("race_results").insert(');
    expect(deleteMatch).not.toBeNull();
    expect(insertIdx).toBeGreaterThan(-1);
    expect(deleteMatch!.index!).toBeLessThan(insertIdx);
    expect(publishServiceSource).not.toMatch(/\.from\("race_results"\)\s*\.upsert/);
  });
});

// ---------------------------------------------------------------------------
// 9c. Non-participants no longer get a phantom classified row on publish (N2
//     — reserves/free-agents left untouched in the results step default to
//     result_status "classified" + finishing_position null. Pre-fix, that
//     row was published as-is, rendering "Pnull" downstream. Filtering it
//     out here is safe: validatePublishResults already excludes it from the
//     classified-count/duplicate-position checks, and calculateRacePoints
//     scores it 0, so points/standings are unaffected either way.)
// ---------------------------------------------------------------------------

describe("filterPublishedResults", () => {
  const participant: RaceResultEntry = {
    driver_id: "d1",
    team_id: "t1",
    finishing_position: 3,
    result_status: "classified",
    fastest_lap: false,
    manual_points_adjustment: 0,
    raw_result: null,
    notes: null,
  };

  const untouchedNonParticipant: RaceResultEntry = {
    driver_id: "reserve-1",
    team_id: "t1",
    finishing_position: null,
    result_status: "classified",
    fastest_lap: false,
    manual_points_adjustment: 0,
    raw_result: null,
    notes: null,
  };

  it("drops a classified row with a null finishing_position", () => {
    expect(filterPublishedResults([participant, untouchedNonParticipant])).toEqual([
      participant,
    ]);
  });

  it("keeps a non-classified row with a null finishing_position (e.g. DNS)", () => {
    const dns: RaceResultEntry = { ...untouchedNonParticipant, result_status: "dns" };
    expect(filterPublishedResults([dns])).toEqual([dns]);
  });

  it("keeps every row when all are properly classified", () => {
    const rows = [participant, { ...participant, driver_id: "d2", finishing_position: 4 }];
    expect(filterPublishedResults(rows)).toEqual(rows);
  });
});

describe("RaceResultEntry — client-supplied points are rejected (test 11)", () => {
  it("RaceResultEntry type has no points_awarded field — server recalculates it", () => {
    const entry: RaceResultEntry = {
      driver_id: "d1",
      team_id: "t1",
      finishing_position: 1,
      result_status: "classified",
      fastest_lap: true,
      manual_points_adjustment: 0,
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
