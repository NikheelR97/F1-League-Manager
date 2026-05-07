import {
  FASTEST_LAP_BONUS,
  MAX_DRIVERS_PER_RACE,
  MAX_WHEEL_CIRCUITS,
  STANDARD_POINTS,
} from "@/lib/constants";

describe("project constants", () => {
  it("keeps race and wheel bounds aligned to F1 league limits", () => {
    expect(MAX_DRIVERS_PER_RACE).toBe(20);
    expect(MAX_WHEEL_CIRCUITS).toBe(24);
  });

  it("defines the default standard F1 points and fastest lap bonus", () => {
    expect(STANDARD_POINTS[1]).toBe(25);
    expect(STANDARD_POINTS[10]).toBe(1);
    expect(STANDARD_POINTS[11]).toBeUndefined();
    expect(FASTEST_LAP_BONUS).toBe(1);
  });
});
