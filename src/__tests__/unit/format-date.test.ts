import { describe, expect, it } from "vitest";

import { formatDateTime, formatTime } from "@/lib/format-date";

// The league runs in South Africa, so date/time helpers pin both locale
// ("en-GB") and timeZone ("Africa/Johannesburg", SAST/UTC+2) — output is
// deterministic everywhere (no server-vs-browser hydration mismatch) and
// reads in the league's local time.

describe("formatDateTime", () => {
  it("returns the exact deterministic string for a fixed ISO input (SAST)", () => {
    // 15:08 UTC == 17:08 SAST
    expect(formatDateTime("2026-07-08T15:08:00Z")).toBe("8 Jul 2026, 17:08");
  });

  it("does not depend on the ambient TZ", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const inNewYork = formatDateTime("2026-07-08T15:08:00Z");

      process.env.TZ = "Asia/Kolkata";
      const inKolkata = formatDateTime("2026-07-08T15:08:00Z");

      // Pinned timeZone means both render in SAST regardless of ambient TZ.
      expect(inNewYork).toBe("8 Jul 2026, 17:08");
      expect(inKolkata).toBe("8 Jul 2026, 17:08");
      expect(inNewYork).toBe(inKolkata);
    } finally {
      process.env.TZ = original;
    }
  });

  it("returns an empty string for a null/undefined input", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
  });
});

describe("formatTime", () => {
  it("renders a 19:00 UTC race as 21:00 (9PM) SAST", () => {
    expect(formatTime("2026-08-07T19:00:00Z")).toBe("21:00");
  });

  it("returns an empty string for a null/undefined input", () => {
    expect(formatTime(null)).toBe("");
    expect(formatTime(undefined)).toBe("");
  });
});
