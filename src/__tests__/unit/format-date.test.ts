import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/lib/format-date";

// Audit fix — formatDateTime previously called toLocaleString() with no
// timeZone (and relied on the runtime's ambient locale), so it rendered
// differently on the server (often UTC) vs. a browser in a local timezone —
// a hydration mismatch in AuditLogTable. The fix pins both locale ("en-GB")
// and timeZone ("UTC") so the output is deterministic everywhere.

describe("formatDateTime", () => {
  it("returns the exact deterministic string for a fixed ISO input", () => {
    expect(formatDateTime("2026-07-08T15:08:00Z")).toBe("8 Jul 2026, 15:08");
  });

  it("does not depend on the ambient TZ", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const inNewYork = formatDateTime("2026-07-08T15:08:00Z");

      process.env.TZ = "Asia/Kolkata";
      const inKolkata = formatDateTime("2026-07-08T15:08:00Z");

      // Pre-fix (no pinned timeZone) these would diverge — 11:08 in New York,
      // 20:38 in Kolkata — because toLocaleString used the ambient TZ.
      expect(inNewYork).toBe("8 Jul 2026, 15:08");
      expect(inKolkata).toBe("8 Jul 2026, 15:08");
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
