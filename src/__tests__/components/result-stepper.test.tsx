import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResultStepper,
  type LeagueTeam,
  type SessionDriver,
  type SessionInfo,
} from "@/components/admin/ResultStepper";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

function makeDriver(id: string, name: string): SessionDriver {
  return {
    color_hex: "#ffffff",
    display_name: name,
    driver_id: id,
    racing_number: 1,
    team_id: "team-1",
    team_name: "Team One",
  };
}

const teams: LeagueTeam[] = [{ color_hex: "#ffffff", id: "team-1", name: "Team One" }];

const session: SessionInfo = {
  fastest_lap_enabled: true,
  id: "session-1",
  league_id: "league-1",
  name: "Race",
  pole_position_enabled: true,
  points_system: { fastest_lap_points: 1, points_by_position: { "1": 25 }, pole_position_points: 1 },
};

const draftKey = `result-stepper-draft:${session.id}`;

const defaultResultRow = {
  fastest_lap: false,
  finishing_position: null as number | null,
  manual_points_adjustment: 0,
  notes: "",
  penalty_points: 0,
  raw_result: "",
  result_status: "classified" as const,
  team_id: "team-1",
};

describe("ResultStepper draft persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("writes a draft to sessionStorage when data is entered", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.type(screen.getByPlaceholderText("—"), "3");

    const raw = sessionStorage.getItem(draftKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.qualifyingRows).toContainEqual(
      expect.objectContaining({ driver_id: "driver-1", qualifying_position: 3 }),
    );
  });

  it("restores a saved draft on a fresh mount", () => {
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({
        step: "results",
        qualifyingRows: [{ driver_id: "driver-1", is_pole: true, qualifying_position: 2, team_id: "team-1" }],
        resultRows: [{ ...defaultResultRow, driver_id: "driver-1", finishing_position: 5, notes: "restored note" }],
        penaltyRows: [],
      }),
    );

    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    expect(screen.getByText("Draft restored from this browser session.")).toBeInTheDocument();
    // Landed on the "results" step (restored from the draft) with the saved note applied.
    expect(screen.getByDisplayValue("restored note")).toBeInTheDocument();
  });

  it("does not write a draft while the stepper is untouched, and discard leaves none", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    // No input yet — an untouched stepper must not persist a draft, or every
    // revisit would show a bogus "Draft restored" notice.
    expect(sessionStorage.getItem(draftKey)).toBeNull();

    await user.type(screen.getByPlaceholderText("—"), "3");
    expect(sessionStorage.getItem(draftKey)).toBeTruthy();
  });

  it("discarding a restored draft removes it for good", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({
        step: "qualifying",
        qualifyingRows: [{ driver_id: "driver-1", is_pole: false, qualifying_position: 7, team_id: "team-1" }],
        resultRows: [{ ...defaultResultRow, driver_id: "driver-1" }],
        penaltyRows: [],
      }),
    );

    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Discard draft" }));

    // The discard reset must not itself be re-saved as a new draft.
    expect(sessionStorage.getItem(draftKey)).toBeNull();
    expect(
      screen.queryByText("Draft restored from this browser session."),
    ).not.toBeInTheDocument();
  });

  it("does not apply a saved row for a driver no longer in the list", () => {
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({
        step: "qualifying",
        qualifyingRows: [
          { driver_id: "driver-1", is_pole: false, qualifying_position: 4, team_id: "team-1" },
          { driver_id: "driver-removed", is_pole: false, qualifying_position: 1, team_id: "team-1" },
        ],
        resultRows: [
          { ...defaultResultRow, driver_id: "driver-1" },
          { ...defaultResultRow, driver_id: "driver-removed" },
        ],
        penaltyRows: [],
      }),
    );

    // "driver-removed" is no longer part of the session's driver list.
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    expect(screen.queryByText(/driver-removed/i)).not.toBeInTheDocument();
    // Only one driver row is rendered, and it kept its saved value.
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(screen.getByRole("spinbutton")).toHaveValue(4);
  });
});
