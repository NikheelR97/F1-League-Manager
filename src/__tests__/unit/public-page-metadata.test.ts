/**
 * R8 — every public league page builds its browser-tab title through the shared
 * pageTitle() helper so the "| F1 Esports League Manager" suffix stays
 * consistent across all 13 pages. Tested at the helper level (pure) rather than
 * by importing each server page module — importing a page pulls its whole
 * component tree into coverage, which is what E2E already exercises.
 */
import { describe, expect, it } from "vitest";

import { pageTitle, SITE_NAME } from "@/lib/public/page-title";

describe("pageTitle", () => {
  it("appends the site-name suffix to a page-specific label", () => {
    expect(pageTitle("Driver Standings — Standard League")).toBe(
      "Driver Standings — Standard League | F1 Esports League Manager",
    );
  });

  it("uses the shared SITE_NAME constant so the suffix can't drift", () => {
    expect(pageTitle("Calendar")).toBe(`Calendar | ${SITE_NAME}`);
  });
});
