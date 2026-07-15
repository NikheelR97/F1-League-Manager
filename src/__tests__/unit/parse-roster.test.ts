import { describe, expect, it } from "vitest";

import { parseRoster, parseRosterLine } from "@/lib/drivers/parse-roster";

describe("parseRosterLine", () => {
  it("parses a name-only line", () => {
    expect(parseRosterLine("Lewis Hamilton")).toEqual({
      display_name: "Lewis Hamilton",
      racing_number: null,
    });
  });

  it("parses a trailing bare number", () => {
    expect(parseRosterLine("Max Verstappen 1")).toEqual({
      display_name: "Max Verstappen",
      racing_number: 1,
    });
  });

  it("parses a trailing #-prefixed number", () => {
    expect(parseRosterLine("Max Verstappen #33")).toEqual({
      display_name: "Max Verstappen",
      racing_number: 33,
    });
  });

  it("returns null for a blank line", () => {
    expect(parseRosterLine("   ")).toBeNull();
  });

  it("keeps a trailing non-number word as part of the name", () => {
    expect(parseRosterLine("Turn 10 Racing")).toEqual({
      display_name: "Turn 10 Racing",
      racing_number: null,
    });
  });
});

describe("parseRoster", () => {
  it("splits multiline text and drops blank lines", () => {
    const text = "Max Verstappen 1\n\nLewis Hamilton\n  \nCharles Leclerc #16";
    expect(parseRoster(text)).toEqual([
      { display_name: "Max Verstappen", racing_number: 1 },
      { display_name: "Lewis Hamilton", racing_number: null },
      { display_name: "Charles Leclerc", racing_number: 16 },
    ]);
  });
});
