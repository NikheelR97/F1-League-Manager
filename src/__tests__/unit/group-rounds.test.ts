import { describe, expect, it } from "vitest";

import { groupRounds } from "@/lib/public/group-rounds";

describe("groupRounds", () => {
  it("merges sprint under feature of the same round, keeps order", () => {
    const s = [
      { id: "b2", race_number: 2 },
      { id: "b1", race_number: 1 },
      { id: "a1", race_number: 1 },
    ];
    const rn = new Map([["b2", 2], ["b1", 2], ["a1", 1]]);
    const g = groupRounds(s, rn);
    expect(g.map((x) => x.main.id)).toEqual(["b1", "a1"]);
    expect(g[0].extras.map((x) => x.id)).toEqual(["b2"]);
    expect(g[0].round).toBe(2);
  });
});
