import { describe, expect, it } from "vitest";

import { selectOfficialTeamsToAdd, type OfficialTemplateRow } from "@/lib/teams/select-official-teams";

const tpl = (slug: string): OfficialTemplateRow => ({
  color_hex: "#ffffff",
  id: slug,
  name: slug,
  slug,
});

describe("selectOfficialTeamsToAdd", () => {
  const templates = ["ferrari", "red-bull", "mercedes", "mclaren"].map(tpl);

  it("returns every template for an empty league", () => {
    const out = selectOfficialTeamsToAdd(templates, new Set(), 0, 15);
    expect(out.map((t) => t.slug)).toEqual(["ferrari", "red-bull", "mercedes", "mclaren"]);
  });

  it("skips templates whose slug is already a team", () => {
    const out = selectOfficialTeamsToAdd(templates, new Set(["ferrari", "mclaren"]), 2, 15);
    expect(out.map((t) => t.slug)).toEqual(["red-bull", "mercedes"]);
  });

  it("never exceeds the remaining cap", () => {
    const out = selectOfficialTeamsToAdd(templates, new Set(), 13, 15);
    expect(out.map((t) => t.slug)).toEqual(["ferrari", "red-bull"]);
  });

  it("returns nothing when the league is full", () => {
    expect(selectOfficialTeamsToAdd(templates, new Set(), 15, 15)).toEqual([]);
  });
});
