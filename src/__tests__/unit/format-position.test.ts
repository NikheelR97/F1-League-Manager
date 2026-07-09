import { describe, expect, it } from "vitest";

import { formatPosition } from "@/lib/public/format-position";

// N2 — a classified result row can carry a null finishing_position (a
// reserve/free-agent who wasn't entered in the session still gets a default
// "classified" row on publish — see filterPublishedResults in
// publish-service.ts for the paired data-side fix). Pre-fix, the team and
// driver pages rendered `P${r.finishing_position}` directly, printing the
// literal string "Pnull" for these rows.

describe("formatPosition", () => {
  it("formats a classified row with a real position as P<n>", () => {
    expect(formatPosition("classified", 1)).toBe("P1");
    expect(formatPosition("classified", 12)).toBe("P12");
  });

  it("renders — for a classified row with a null position, not Pnull", () => {
    expect(formatPosition("classified", null)).toBe("—");
  });

  it("renders the uppercased status for a non-classified row", () => {
    expect(formatPosition("dnf", null)).toBe("DNF");
    expect(formatPosition("dsq", 5)).toBe("DSQ");
  });
});
