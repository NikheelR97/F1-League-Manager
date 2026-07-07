import { roundPrefix } from "@/lib/public/round-prefix";

describe("roundPrefix", () => {
  it("prepends the round when the name doesn't already say Round", () => {
    expect(roundPrefix(3, "Japanese Grand Prix")).toBe("Round 3 · ");
  });

  it("skips the prefix when the name already starts with Round", () => {
    expect(roundPrefix(3, "Round 1 — Japan")).toBe("");
    expect(roundPrefix(3, "round 1 - Japan")).toBe("");
  });

  it("is empty when there is no round number", () => {
    expect(roundPrefix(null, "Japanese Grand Prix")).toBe("");
    expect(roundPrefix(undefined, "Japanese Grand Prix")).toBe("");
    expect(roundPrefix(0, "Japanese Grand Prix")).toBe("");
  });
});
