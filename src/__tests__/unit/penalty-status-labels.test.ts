import { describe, expect, it } from "vitest";

import { PENALTY_STATUS_LABELS } from "@/lib/penalties/status-labels";

describe("PENALTY_STATUS_LABELS", () => {
  it("maps all penalty statuses to display labels", () => {
    expect(PENALTY_STATUS_LABELS.open).toBe("Open");
    expect(PENALTY_STATUS_LABELS.served).toBe("Served");
    expect(PENALTY_STATUS_LABELS.appealed).toBe("Under Appeal");
    expect(PENALTY_STATUS_LABELS.rescinded).toBe("Rescinded");
  });
});
