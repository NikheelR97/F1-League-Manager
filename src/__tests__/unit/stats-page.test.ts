import { describe, expect, it } from "vitest";

import {
  computeBiggestClimbers,
  type ClimberQualiRow,
  type ClimberRaceRow,
} from "@/lib/public/stats";

describe("computeBiggestClimbers", () => {
  it("pairs race results with qualifying position and returns the best climb per driver", () => {
    const raceRows: ClimberRaceRow[] = [
      { race_session_id: "s1", driver_id: "d1", finishing_position: 3, result_status: "classified" },
      { race_session_id: "s2", driver_id: "d1", finishing_position: 10, result_status: "classified" },
      { race_session_id: "s1", driver_id: "d2", finishing_position: 1, result_status: "classified" },
    ];
    const qualiRows: ClimberQualiRow[] = [
      { race_session_id: "s1", driver_id: "d1", qualifying_position: 15 }, // +12
      { race_session_id: "s2", driver_id: "d1", qualifying_position: 12 }, // +2
      { race_session_id: "s1", driver_id: "d2", qualifying_position: 1 }, // +0, filtered out
    ];

    const result = computeBiggestClimbers(raceRows, qualiRows);

    expect(result).toEqual([{ driverId: "d1", gained: 12 }]);
  });

  it("skips non-classified results and rows without a matching qualifying record", () => {
    const raceRows: ClimberRaceRow[] = [
      { race_session_id: "s1", driver_id: "d1", finishing_position: null, result_status: "dnf" },
      { race_session_id: "s1", driver_id: "d2", finishing_position: 5, result_status: "classified" }, // no quali row
    ];
    const qualiRows: ClimberQualiRow[] = [];

    expect(computeBiggestClimbers(raceRows, qualiRows)).toEqual([]);
  });

  it("ignores drivers who lost places and respects the limit", () => {
    const raceRows: ClimberRaceRow[] = [
      { race_session_id: "s1", driver_id: "lost", finishing_position: 10, result_status: "classified" },
      { race_session_id: "s1", driver_id: "a", finishing_position: 5, result_status: "classified" },
      { race_session_id: "s1", driver_id: "b", finishing_position: 4, result_status: "classified" },
      { race_session_id: "s1", driver_id: "c", finishing_position: 3, result_status: "classified" },
    ];
    const qualiRows: ClimberQualiRow[] = [
      { race_session_id: "s1", driver_id: "lost", qualifying_position: 2 }, // -8, filtered out
      { race_session_id: "s1", driver_id: "a", qualifying_position: 10 }, // +5
      { race_session_id: "s1", driver_id: "b", qualifying_position: 20 }, // +16
      { race_session_id: "s1", driver_id: "c", qualifying_position: 8 }, // +5
    ];

    const result = computeBiggestClimbers(raceRows, qualiRows, 2);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ driverId: "b", gained: 16 });
  });
});
