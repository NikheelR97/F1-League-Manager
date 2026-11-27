import { describe, expect, it, vi } from "vitest";

import {
  buildRoundSummary,
  loadRoundSummary,
  type SummaryResult,
  type SummarySession,
} from "@/lib/public/round-summary";

const sessions: SummarySession[] = [
  { circuit: "Bahrain", id: "r1", name: "Bahrain GP", race_number: 1, scheduled_at: "2026-03-05T19:00:00Z" },
  { circuit: "Jeddah", id: "sprint", name: "Saudi Sprint", race_number: 2, scheduled_at: "2026-03-12T19:00:00Z" },
  { circuit: "Jeddah", id: "feature", name: "Saudi GP", race_number: 1, scheduled_at: "2026-03-12T19:40:00Z" },
];

const r = (
  race_session_id: string,
  driver_id: string,
  team_id: string,
  finishing_position: number | null,
  points_awarded: number,
  manual_points_adjustment = 0,
): SummaryResult => ({
  driver_id,
  driver_name: driver_id.toUpperCase(),
  finishing_position,
  manual_points_adjustment,
  points_awarded,
  race_session_id,
  team_id,
});

const results = [
  r("r1", "a", "t1", 1, 25),
  r("sprint", "a", "t1", 1, 8),
  r("sprint", "b", "t1", 2, 7),
  r("feature", "a", "t1", 1, 25, -7),
  r("feature", "b", "t1", 2, 18),
  r("feature", "c", "t2", 3, 15),
  r("feature", "d", "t2", null, 0), // DNS
];

const drivers = [
  { id: "a", name: "A", position: 1, previous_position: 1 },
  { id: "b", name: "B", position: 2, previous_position: 4 },
  { id: "c", name: "C", position: 3, previous_position: 2 },
  { id: "d", name: "D", position: 4, previous_position: 3 },
  { id: "e", name: "E", position: 5, previous_position: null },
];

describe("buildRoundSummary", () => {
  it("returns null with no completed sessions", () => {
    expect(buildRoundSummary([], [], drivers)).toBeNull();
  });

  it("sums sprint and feature on the same SAST day and ignores earlier rounds", () => {
    const s = buildRoundSummary(sessions, results, drivers)!;
    expect(s.driverRoundPoints.get("b")).toBe(25);
  });

  it("applies the manual race-day adjustment", () => {
    const s = buildRoundSummary(sessions, results, drivers)!;
    expect(s.driverRoundPoints.get("a")).toBe(8 + 18);
  });

  it("counts DNS rows as zero", () => {
    const s = buildRoundSummary(sessions, results, drivers)!;
    expect(s.driverRoundPoints.get("d")).toBe(0);
  });

  it("takes the podium from the feature session", () => {
    const s = buildRoundSummary(sessions, results, drivers)!;
    expect(s.roundName).toBe("Saudi GP");
    expect(s.podium).toEqual([
      { driverName: "A", points: 18, position: 1 },
      { driverName: "B", points: 18, position: 2 },
      { driverName: "C", points: 15, position: 3 },
    ]);
  });

  it("sums team points across drivers", () => {
    const s = buildRoundSummary(sessions, results, drivers)!;
    expect(s.teamRoundPoints.get("t1")).toBe(26 + 25);
    expect(s.teamRoundPoints.get("t2")).toBe(15);
  });

  it("lists movers largest first, excluding null and zero deltas", () => {
    const s = buildRoundSummary(sessions, results, drivers)!;
    expect(s.movers.up).toEqual([{ delta: 2, name: "B" }]);
    expect(s.movers.down).toEqual([
      { delta: -1, name: "C" },
      { delta: -1, name: "D" },
    ]);
  });

  it("numbers the round by distinct SAST race nights", () => {
    expect(buildRoundSummary(sessions, results, drivers)!.roundNumber).toBe(2);
  });
});

const tables: Record<string, unknown[]> = {};
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: (table: string) => {
      let status = "";
      const q = {
        eq: (col: string, v: string) => ((status = col === "status" ? v : status), q),
        in: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: (tables[`${table}:${status}`] ?? [])[0] ?? null }),
        order: () => q,
        select: () => q,
        then: (res: (v: { data: unknown[] }) => unknown) =>
          Promise.resolve({ data: tables[`${table}:${status}`] ?? tables[table] ?? [] }).then(res),
      };
      return q;
    },
  }),
}));

describe("loadRoundSummary", () => {
  it("returns nulls when nothing is completed or scheduled", async () => {
    for (const k of Object.keys(tables)) delete tables[k];
    expect(await loadRoundSummary("l", "s")).toEqual({ nextSession: null, summary: null });
  });

  it("maps sessions, results, standings and the next session", async () => {
    tables["race_sessions:completed"] = [
      { circuits: { name: "Jeddah" }, id: "f", name: "Saudi GP", race_number: 1, scheduled_at: "2026-03-12T19:00:00Z" },
    ];
    tables["race_sessions:scheduled"] = [{ circuits: null, scheduled_at: "2026-03-19T19:00:00Z" }];
    tables["driver_standings"] = [
      { drivers: { display_name: "A", id: "a" }, position: 1, previous_position: 2 },
      { drivers: null, position: 2, previous_position: 1 },
    ];
    tables["race_results"] = [
      { driver_id: "a", drivers: { display_name: "A" }, finishing_position: 1, manual_points_adjustment: -7, points_awarded: 25, race_session_id: "f", team_id: "t" },
      { driver_id: "z", drivers: null, finishing_position: 2, manual_points_adjustment: 0, points_awarded: 18, race_session_id: "f", team_id: "t" },
    ];
    const { nextSession, summary } = await loadRoundSummary("l", "s");
    expect(nextSession).toEqual({ circuit: null, scheduled_at: "2026-03-19T19:00:00Z" });
    expect(summary?.podium.map((p) => p.driverName)).toEqual(["A", "TBD"]);
    expect(summary?.driverRoundPoints.get("a")).toBe(18);
    expect(summary?.movers.up).toEqual([{ delta: 1, name: "A" }]);
    expect(summary?.movers.down).toEqual([{ delta: -1, name: "TBD" }]);
  });
});
