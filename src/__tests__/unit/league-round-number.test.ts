import { describe, expect, it } from "vitest";

import { leagueRoundNumbers } from "@/lib/public/league-round-number";

describe("leagueRoundNumbers", () => {
  it("gives sprint and feature on the same night one round, ordered by date", () => {
    const m = leagueRoundNumbers([
      { id: "c", scheduled_at: "2026-03-10T18:00:00Z" },
      { id: "feature", scheduled_at: "2026-03-03T18:40:00Z" },
      { id: "sprint", scheduled_at: "2026-03-03T18:00:00Z" },
    ]);
    expect(m.get("sprint")).toBe(1);
    expect(m.get("feature")).toBe(1);
    expect(m.get("c")).toBe(2);
  });

  it("uses the SAST day: 22:30 UTC is the next day", () => {
    const m = leagueRoundNumbers([
      { id: "a", scheduled_at: "2026-03-03T22:30:00Z" },
      { id: "b", scheduled_at: "2026-03-04T05:00:00Z" },
      { id: "c", scheduled_at: "2026-03-03T21:30:00Z" },
    ]);
    expect(m.get("c")).toBe(1);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(2);
  });
});
