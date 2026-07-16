import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResultStepper,
  type LeagueTeam,
  type SessionDriver,
  type SessionInfo,
} from "@/components/admin/ResultStepper";

let nextRacingNumber = 1;

function makeDriver(
  id: string,
  name: string,
  racingNumber?: number,
  overrides: Partial<SessionDriver> = {},
): SessionDriver {
  return {
    color_hex: "#ffffff",
    display_name: name,
    driver_id: id,
    racing_number: racingNumber ?? nextRacingNumber++,
    team_id: "team-1",
    team_name: "Team One",
    ...overrides,
  };
}

const teams: LeagueTeam[] = [
  { color_hex: "#ffffff", id: "team-1", name: "Team One" },
  { color_hex: "#00ffff", id: "team-2", name: "Team Two" },
];

const session: SessionInfo = {
  fastest_lap_enabled: true,
  id: "session-1",
  league_id: "league-1",
  name: "Race",
  pole_position_enabled: true,
  points_system: { fastest_lap_points: 1, points_by_position: { "1": 25 }, pole_position_points: 1 },
};

const draftKey = `f1lm:result-draft:${session.id}`;

const defaultResultRow = {
  covering_for_driver_id: null as string | null,
  fastest_lap: false,
  finishing_position: null as number | null,
  manual_points_adjustment: 0,
  notes: "",
  raw_result: "",
  result_status: "classified" as const,
  team_id: "team-1",
};

describe("ResultStepper full publish flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }),
    );
  });

  it("walks all four steps and publishes the entered results", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One"), makeDriver("driver-2", "Driver Two")];
    render(
      <ResultStepper drivers={drivers} leagueSlug="apex-gp" session={session} teams={teams} />,
    );

    // Qualifying: positions 1 and 2 — pole for driver one is derived from P1,
    // no separate control to click (S13-T2).
    const qualiInputs = screen.getAllByPlaceholderText("—");
    await user.type(qualiInputs[0], "1");
    await user.type(qualiInputs[1], "2");
    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));

    // Results: finishing positions, fastest lap for driver one, DNF for driver two
    const posInputs = screen.getAllByPlaceholderText("—");
    await user.type(posInputs[0], "1");
    await user.click(screen.getAllByRole("checkbox")[0]);
    const statusSelects = screen
      .getAllByRole("combobox")
      .filter((el) => (el as HTMLSelectElement).value === "classified");
    await user.selectOptions(statusSelects[1], "dnf");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));

    // Penalties: one formal penalty for the default (first) driver
    await user.click(screen.getByRole("button", { name: /Add Penalty/i }));
    await user.type(screen.getByPlaceholderText("Collision at Turn 1"), "Turn 1 contact");
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));

    // Review: points preview (25 base + 1 FL + 1 pole) and publish
    expect(screen.getByText("Turn 1 contact")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish Results" }));

    const publishCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) =>
      String(url).includes("/api/admin/sessions/session-1/publish"),
    );
    expect(publishCall).toBeDefined();
    const body = JSON.parse(publishCall![1].body);
    expect(body.qualifying).toContainEqual(
      expect.objectContaining({ driver_id: "driver-1", is_pole: true, qualifying_position: 1 }),
    );
    expect(body.results).toContainEqual(
      expect.objectContaining({ driver_id: "driver-1", finishing_position: 1, fastest_lap: true }),
    );
    expect(body.results).toContainEqual(
      expect.objectContaining({ driver_id: "driver-2", result_status: "dnf", finishing_position: null }),
    );
    expect(body.penalties).toContainEqual(
      expect.objectContaining({ driver_id: "driver-1", reason: "Turn 1 contact" }),
    );

    // Draft cleared, and a success banner (not a silent redirect) is shown
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Results published.");
    expect(screen.getByRole("link", { name: /view public result/i })).toHaveAttribute(
      "href",
      "/leagues/apex-gp/results/session-1",
    );
    expect(screen.getByRole("link", { name: /back to league/i })).toHaveAttribute(
      "href",
      "/admin/leagues/league-1",
    );
    // K1 — keyboard focus follows the announcement onto the banner instead
    // of staying on the now-unmounted Publish button.
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("blocks publish while validation errors exist", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One"), makeDriver("driver-2", "Driver Two")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    // Duplicate finishing positions
    const posInputs = screen.getAllByPlaceholderText("—");
    await user.type(posInputs[0], "1");
    await user.type(posInputs[1], "1");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));

    expect(screen.getByText(/Duplicate finishing positions/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish Results" })).toBeDisabled();
    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
        String(url).includes("/publish"),
      ),
    ).toBe(false);
  });

  it("surfaces a server error from a failed publish", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Session already published" }), { status: 409 }),
        );
      }),
    );
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.type(screen.getByPlaceholderText("—"), "1");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    await user.click(screen.getByRole("button", { name: "Publish Results" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Session already published");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("surfaces the first field-level reason from a Zod flatten() 422 body", async () => {
    // X3/M1 — the 422 path sends z.ZodError#flatten(), which carries the real
    // reason the request failed. Show that instead of a generic guess.
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { formErrors: [], fieldErrors: { results: ["Duplicate finishing position"] } },
            }),
            { status: 422 },
          ),
        );
      }),
    );
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.type(screen.getByPlaceholderText("—"), "1");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    await user.click(screen.getByRole("button", { name: "Publish Results" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate finishing position");
  });

  it("falls back to a plain message when no field reason can be extracted", async () => {
    // N5(c) — FormError only ever renders a string, so a non-string error
    // with no usable formErrors/fieldErrors must fall back, not crash.
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: { formErrors: [], fieldErrors: {} } }), {
            status: 422,
          }),
        );
      }),
    );
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.type(screen.getByPlaceholderText("—"), "1");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    await user.click(screen.getByRole("button", { name: "Publish Results" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't publish — please review your entries.",
    );
  });
});

describe("ResultStepper draft persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
    // M4 — discard now confirms first; default to "yes" so existing discard
    // tests exercise the post-confirm behavior.
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("writes a draft to localStorage when data is entered", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.type(screen.getByPlaceholderText("—"), "3");

    const raw = localStorage.getItem(draftKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.qualifyingRows).toContainEqual(
      expect.objectContaining({ driver_id: "driver-1", qualifying_position: 3 }),
    );
  });

  it("restores a saved draft on a fresh mount", () => {
    localStorage.setItem(
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

    expect(screen.getByText(/Draft saved · \d{2}:\d{2}/)).toBeInTheDocument();
    // Landed on the "results" step (restored from the draft) with the saved note applied.
    expect(screen.getByDisplayValue("restored note")).toBeInTheDocument();
  });

  it("does not write a draft while the stepper is untouched, and discard leaves none", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    // No input yet — an untouched stepper must not persist a draft, or every
    // revisit would show a bogus "Draft saved" indicator.
    expect(localStorage.getItem(draftKey)).toBeNull();

    await user.type(screen.getByPlaceholderText("—"), "3");
    expect(localStorage.getItem(draftKey)).toBeTruthy();
  });

  it("discarding a restored draft removes it for good", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
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

    expect(window.confirm).toHaveBeenCalledWith(
      "Discard the entire draft? All entered qualifying, race, and penalty data will be lost.",
    );
    // The discard reset must not itself be re-saved as a new draft.
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(screen.queryByText(/Draft saved ·/)).not.toBeInTheDocument();
  });

  it("keeps the draft when the discard confirmation is declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    localStorage.setItem(
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

    expect(localStorage.getItem(draftKey)).toBeTruthy();
    expect(screen.getByText(/Draft saved · \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("does not apply a saved row for a driver no longer in the list", () => {
    localStorage.setItem(
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

describe("ResultStepper row ordering (M1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("orders the Qualifying step's initial roster by racing number, not roster order", () => {
    const drivers = [
      makeDriver("driver-c", "Driver C", 30),
      makeDriver("driver-a", "Driver A", 10),
      makeDriver("driver-b", "Driver B", 20),
    ];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    const rows = screen.getAllByRole("row").slice(1); // drop header row
    const names = rows.map((r) => within(r).getByText(/^Driver [ABC]$/).textContent);
    expect(names).toEqual(["Driver A", "Driver B", "Driver C"]);
  });

  it("orders the Results step by qualifying position; drivers with no position sort last", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-a", "Driver A"),
      makeDriver("driver-b", "Driver B"),
      makeDriver("driver-c", "Driver C"),
      makeDriver("driver-d", "Driver D"),
    ];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    const qualiInputs = screen.getAllByPlaceholderText("—");
    await user.type(qualiInputs[0], "3"); // Driver A -> P3
    await user.type(qualiInputs[1], "1"); // Driver B -> P1
    await user.type(qualiInputs[2], "2"); // Driver C -> P2
    // Driver D left blank (no quali position, e.g. DNS) — sorts last.
    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));

    const rows = screen.getAllByRole("row").slice(1);
    const names = rows.map((r) => within(r).getByText(/^Driver [ABCD]$/).textContent);
    expect(names).toEqual(["Driver B", "Driver C", "Driver A", "Driver D"]);
  });
});

describe("ResultStepper inline result validation (M2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("highlights offending rows inline when duplicate positions are typed, without blocking navigation", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One"), makeDriver("driver-2", "Driver Two")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    const posInputs = screen.getAllByPlaceholderText("—");
    await user.type(posInputs[0], "1");
    await user.type(posInputs[1], "1");

    // Each offending row renders its own copy of the message with a stable id.
    const messages = screen.getAllByText(/P1 assigned to Driver One and Driver Two/);
    expect(messages).toHaveLength(2);
    expect(posInputs[0]).toHaveAttribute("aria-invalid", "true");
    expect(posInputs[0]).toHaveAttribute("aria-describedby", "pos-error-driver-1");
    expect(posInputs[1]).toHaveAttribute("aria-describedby", "pos-error-driver-2");

    // Errors are surfaced, not enforced — step navigation stays open.
    expect(screen.getByRole("button", { name: /Next: Penalties/i })).toBeEnabled();
  });

  it("highlights every row when a restored draft has more than one fastest lap", () => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        step: "results",
        qualifyingRows: [
          { driver_id: "driver-1", is_pole: false, qualifying_position: null, team_id: "team-1" },
          { driver_id: "driver-2", is_pole: false, qualifying_position: null, team_id: "team-1" },
        ],
        resultRows: [
          { ...defaultResultRow, driver_id: "driver-1", fastest_lap: true },
          { ...defaultResultRow, driver_id: "driver-2", fastest_lap: true },
        ],
        penaltyRows: [],
      }),
    );
    const drivers = [makeDriver("driver-1", "Driver One"), makeDriver("driver-2", "Driver Two")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    expect(screen.getAllByText("Only one fastest lap")).toHaveLength(2);
  });
});

describe("ResultStepper team-as-of-date note (M7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("shows a note when the row's team differs from the driver's present-day team", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-1", "Driver One", undefined, { present_team_id: "team-2" }),
    ];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));

    expect(screen.getByText("Team as of race date")).toBeInTheDocument();
  });

  it("shows no note when present-day team matches the resolved team", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-1", "Driver One", undefined, { present_team_id: "team-1" }),
    ];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));

    expect(screen.queryByText("Team as of race date")).not.toBeInTheDocument();
  });
});

describe("ResultStepper banned-driver badge (B3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("flags a banned driver, naming the session, in both Qualifying and Results steps", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One"), makeDriver("driver-2", "Driver Two")];
    render(
      <ResultStepper
        bannedDrivers={[{ driver_id: "driver-1", session_name: "Round 3" }]}
        drivers={drivers}
        session={session}
        teams={teams}
      />,
    );

    expect(screen.getByText("Banned in Round 3")).toBeInTheDocument();
    expect(screen.queryByText(/Driver Two.*Banned in Round 3/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    expect(screen.getByText("Banned in Round 3")).toBeInTheDocument();
  });

  it("shows no badge when no driver has a recorded ban", () => {
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    expect(screen.queryByText(/Banned in/)).not.toBeInTheDocument();
  });
});

describe("ResultStepper departed-driver row (M9 correction mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("shows a 'Left roster' chip for a driver unioned in from published data", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-1", "Driver One"),
      makeDriver("driver-2", "Departed Driver", undefined, { left_roster: true }),
    ];
    render(
      <ResultStepper correctionMode drivers={drivers} session={session} teams={teams} />,
    );

    expect(screen.getByText("Left roster")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    expect(screen.getByText("Left roster")).toBeInTheDocument();
  });
});

describe("ResultStepper correction mode (M9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }),
    );
  });

  it("shows the correction warning banner and a Republish button", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(
      <ResultStepper correctionMode drivers={drivers} session={session} teams={teams} />,
    );

    expect(screen.getByText(/Editing published results/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    // Banner persists across steps, not just the step it started on.
    expect(screen.getByText(/Editing published results/i)).toBeInTheDocument();
  });

  it("prefills from published data and ignores a stale localStorage draft", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        step: "results",
        qualifyingRows: [{ driver_id: "driver-1", is_pole: false, qualifying_position: 9, team_id: "team-1" }],
        resultRows: [{ ...defaultResultRow, driver_id: "driver-1", finishing_position: 9 }],
        penaltyRows: [],
      }),
    );

    const drivers = [makeDriver("driver-1", "Driver One")];
    render(
      <ResultStepper
        correctionMode
        drivers={drivers}
        initialResultRows={[{ ...defaultResultRow, driver_id: "driver-1", finishing_position: 3 }]}
        session={session}
        teams={teams}
      />,
    );

    // Lands on the default first step (qualifying), not the draft's "results" step.
    expect(screen.getByRole("heading", { name: "Qualifying" })).toBeInTheDocument();
    expect(screen.queryByText(/Draft saved ·/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    // Published value (3) wins over the stale draft's value (9).
    expect(screen.getByPlaceholderText("—")).toHaveValue(3);
  });

  it("gates republish behind a confirm() and sends republish: true", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(
      <ResultStepper
        correctionMode
        drivers={drivers}
        initialResultRows={[{ ...defaultResultRow, driver_id: "driver-1", finishing_position: 1 }]}
        session={session}
        teams={teams}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    await user.click(screen.getByRole("button", { name: "Republish corrected results" }));

    expect(window.confirm).toHaveBeenCalled();
    const publishCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) =>
      String(url).includes("/publish"),
    );
    const body = JSON.parse(publishCall![1].body);
    expect(body.republish).toBe(true);
  });

  it("does not publish when the republish confirm is declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(
      <ResultStepper
        correctionMode
        drivers={drivers}
        initialResultRows={[{ ...defaultResultRow, driver_id: "driver-1", finishing_position: 1 }]}
        session={session}
        teams={teams}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    await user.click(screen.getByRole("button", { name: "Republish corrected results" }));

    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.some(([url]) => String(url).includes("/publish")),
    ).toBe(false);
  });
});

describe("ResultStepper season projection (M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("previews current -> projected season total for a first publish", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(
      <ResultStepper
        driverStandings={[{ driver_id: "driver-1", total_points: 100, wins: 0 }]}
        drivers={drivers}
        session={session}
        teams={teams}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.type(screen.getByPlaceholderText("—"), "1");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));

    // 100 current + 25 (P1) previewed = 125 projected.
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("125")).toBeInTheDocument();
  });

  it("does not double-count already-published points in correction mode", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(
      <ResultStepper
        correctionMode
        driverStandings={[{ driver_id: "driver-1", total_points: 100, wins: 1 }]}
        drivers={drivers}
        initialResultRows={[{ ...defaultResultRow, driver_id: "driver-1", finishing_position: 1 }]}
        previousSessionPoints={[{ driver_id: "driver-1", points: 25 }]}
        session={session}
        teams={teams}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));

    // 100 current already includes this session's 25 pts; re-entering the
    // same P1 result must project back to 100, not 125.
    expect(screen.getAllByText("100")).toHaveLength(2);
  });

  it("tie-breaks the projected top-3 by wins, marking equal points+wins with '='", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-1", "Driver One"),
      makeDriver("driver-2", "Driver Two"),
    ];
    render(
      <ResultStepper
        driverStandings={[
          // Both start at 75 points; driver-2 has more wins, so a projected
          // points tie should resolve driver-2 ahead without relying on
          // insertion order.
          { driver_id: "driver-1", total_points: 75, wins: 0 },
          { driver_id: "driver-2", total_points: 100, wins: 3 },
        ]}
        drivers={drivers}
        session={session}
        teams={teams}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    const posInputs = screen.getAllByPlaceholderText("—");
    // driver-1 finishes P1 this session (+25, +1 win) landing on 100 pts/1 win.
    // driver-2 does not score (no position entered), staying at 100 pts/3 wins.
    // Points tie at 100 — wins tie-break must put driver-2 first.
    await user.type(posInputs[0], "1");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));

    expect(screen.getByText(/1\. Driver Two 100 · 2\. Driver One 100/)).toBeInTheDocument();
  });

  it("marks a genuine points+wins tie in the projected top-3 with an '=' prefix", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-1", "Driver One"),
      makeDriver("driver-2", "Driver Two"),
    ];
    render(
      <ResultStepper
        driverStandings={[
          { driver_id: "driver-1", total_points: 100, wins: 1 },
          { driver_id: "driver-2", total_points: 100, wins: 1 },
        ]}
        drivers={drivers}
        session={session}
        teams={teams}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));

    expect(screen.getByText(/=1\. Driver (One|Two) 100 · =1\. Driver (One|Two) 100/)).toBeInTheDocument();
  });
});

describe("ResultStepper reserve assignment (B7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }),
    );
  });

  it("shows the reserve consequence note only when a roster driver is a reserve", async () => {
    const user = userEvent.setup();
    const withReserve = [
      makeDriver("driver-1", "Driver One"),
      makeDriver("driver-2", "Reserve Driver", undefined, { is_reserve: true }),
    ];
    render(<ResultStepper drivers={withReserve} session={session} teams={teams} />);
    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));

    expect(screen.getByText(/constructor points go to that team/i)).toBeInTheDocument();
  });

  it("hides the reserve consequence note when no roster driver is a reserve", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);
    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));

    expect(screen.queryByText(/constructor points go to that team/i)).not.toBeInTheDocument();
  });

  it("sends covering_for_driver_id for a reserve driver's row on publish", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-1", "Primary Driver"),
      makeDriver("driver-2", "Reserve Driver", undefined, { is_reserve: true }),
    ];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    const posInputs = screen.getAllByPlaceholderText("—");
    await user.type(posInputs[0], "1");
    await user.type(posInputs[1], "2");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Covering for Reserve Driver" }),
      "driver-1",
    );

    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    await user.click(screen.getByRole("button", { name: "Publish Results" }));

    const publishCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) =>
      String(url).includes("/publish"),
    );
    const body = JSON.parse(publishCall![1].body);
    expect(body.results).toContainEqual(
      expect.objectContaining({ driver_id: "driver-2", covering_for_driver_id: "driver-1" }),
    );
    expect(body.results).toContainEqual(
      expect.objectContaining({ driver_id: "driver-1", covering_for_driver_id: null }),
    );
  });
});

describe("ResultStepper points adjustment (F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }),
    );
  });

  it("keeps a negative points adjustment (-5) instead of dropping the minus sign", async () => {
    // F3 — the "Adj pts" input used to be type="number" with
    // onChange={(e) => Number(e.target.value)}. Typing "-" into a number
    // input is immediately discarded by the browser (a lone "-" isn't a
    // valid number), so by the time the "5" keystroke landed the field held
    // just "5" — never "-5". A controlled type="number" input can't hold
    // that intermediate "-" at all, which is exactly what this test would
    // catch: pre-fix, typing "-5" produces manual_points_adjustment: 5 (or
    // 0), not -5.
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    // A classified finishing position is required to pass validation and
    // reach Publish; race points (P1 = 25) let "-5" show as its own value
    // distinct from the race points column on Review.
    await user.type(screen.getByPlaceholderText("—"), "1");
    const adjInput = screen.getByLabelText("Points adjustment for Driver One");
    // The field starts on the default "0" (manual_points_adjustment: 0), so
    // clear it first — same as an admin backspacing/selecting-all before
    // entering a real value.
    await user.clear(adjInput);
    await user.type(adjInput, "-5");

    expect(adjInput).toHaveValue("-5");

    // Review step reflects the negative adjustment, not a mangled positive
    // one — the "Adj" column shows "-5" and "Total champ" shows 20 (25 - 5).
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    expect(screen.getByText("-5")).toBeInTheDocument();
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);

    // Publish payload carries the real negative value through to the API.
    await user.click(screen.getByRole("button", { name: "Publish Results" }));
    const publishCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) =>
      String(url).includes("/publish"),
    );
    const body = JSON.parse(publishCall![1].body);
    expect(body.results).toContainEqual(
      expect.objectContaining({ driver_id: "driver-1", manual_points_adjustment: -5 }),
    );
  });

  it("does not reset the adjustment to 0 while a lone '-' is mid-type", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    const adjInput = screen.getByLabelText("Points adjustment for Driver One");
    await user.clear(adjInput);

    // Type just the minus sign — the field must hold it (as text) without
    // the underlying numeric value snapping back to a wiped-out state.
    await user.type(adjInput, "-");
    expect(adjInput).toHaveValue("-");

    // Finish the number; the row's value should be the completed -5, proving
    // the lone "-" wasn't silently discarded/reset before the next digit.
    await user.type(adjInput, "5");
    expect(adjInput).toHaveValue("-5");
  });

  it("rejects non-numeric characters typed into the adjustment field", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    const adjInput = screen.getByLabelText("Points adjustment for Driver One");
    await user.clear(adjInput);

    await user.type(adjInput, "-5abc");
    expect(adjInput).toHaveValue("-5");
  });
});

describe("ResultStepper penalty row removal focus (K2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("moves focus to the remaining row's remove button after removing one of two", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One"), makeDriver("driver-2", "Driver Two")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));

    await user.click(screen.getByRole("button", { name: /Add Penalty/i }));
    await user.click(screen.getByRole("button", { name: /Add Penalty/i }));
    await user.selectOptions(screen.getAllByRole("combobox", { name: /^Driver for penalty/i })[1], "driver-2");

    await user.click(screen.getByRole("button", { name: "Remove penalty for Driver One" }));

    expect(screen.getByRole("button", { name: "Remove penalty for Driver Two" })).toHaveFocus();
  });

  it("moves focus to the Add Penalty button after removing the last row", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));

    await user.click(screen.getByRole("button", { name: /Add Penalty/i }));
    await user.click(screen.getByRole("button", { name: /Remove penalty for/i }));

    expect(screen.getByRole("button", { name: "+ Add Penalty" })).toHaveFocus();
  });
});

describe("ResultStepper localStorage draft survives a real unmount (S13-T1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }),
    );
  });

  it("restores a value after an actual unmount/remount, then clears the draft on publish", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One")];
    const { unmount } = render(
      <ResultStepper drivers={drivers} session={session} teams={teams} />,
    );

    await user.type(screen.getByPlaceholderText("—"), "4");
    unmount();

    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);
    expect(screen.getByPlaceholderText("—")).toHaveValue(4);
    expect(screen.getByText(/Draft saved · \d{2}:\d{2}/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));
    await user.type(screen.getByPlaceholderText("—"), "1");
    await user.click(screen.getByRole("button", { name: /Next: Penalties/i }));
    await user.click(screen.getByRole("button", { name: /Next: Review & Publish/i }));
    await user.click(screen.getByRole("button", { name: "Publish Results" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Results published.");
    expect(localStorage.getItem(draftKey)).toBeNull();
  });
});

describe("ResultStepper pole derivation (S13-T2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("marks only the driver with qualifying position 1 as pole", async () => {
    const user = userEvent.setup();
    const drivers = [makeDriver("driver-1", "Driver One"), makeDriver("driver-2", "Driver Two")];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    const qualiInputs = screen.getAllByPlaceholderText("—");
    await user.type(qualiInputs[0], "3");
    await user.type(qualiInputs[1], "1");

    expect(screen.getByLabelText("Pole for Driver One")).toHaveTextContent("—");
    expect(screen.getByLabelText("Pole for Driver Two")).toHaveTextContent("POLE");
  });
});

describe("ResultStepper fill sequential positions (S13-T2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("numbers classified rows 1..N in display order and leaves DNF rows blank", async () => {
    const user = userEvent.setup();
    const drivers = [
      makeDriver("driver-1", "Driver One"),
      makeDriver("driver-2", "Driver Two"),
      makeDriver("driver-3", "Driver Three"),
    ];
    render(<ResultStepper drivers={drivers} session={session} teams={teams} />);

    await user.click(screen.getByRole("button", { name: /Next: Race Results/i }));

    const statusSelects = screen
      .getAllByRole("combobox")
      .filter((el) => (el as HTMLSelectElement).value === "classified");
    await user.selectOptions(statusSelects[2], "dnf");

    await user.click(screen.getByRole("button", { name: "Fill sequential positions" }));

    expect(screen.getByLabelText("Finishing position for Driver One")).toHaveValue(1);
    expect(screen.getByLabelText("Finishing position for Driver Two")).toHaveValue(2);
    expect(screen.getByLabelText("Finishing position for Driver Three")).toHaveValue(null);
  });
});
