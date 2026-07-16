import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransferForm } from "@/components/admin/TransferForm";

const ENTRY_1 = "00000000-0000-4000-8000-000000000001";
const ENTRY_2 = "00000000-0000-4000-8000-000000000002";
const TEAM_1 = "00000000-0000-4000-8000-000000000011";
const TEAM_2 = "00000000-0000-4000-8000-000000000012";
const SESSION_1 = "00000000-0000-4000-8000-000000000021";

const drivers = [
  { entryId: ENTRY_1, isReserve: false, name: "Max Verstappen", teamName: "Red Bull" },
  { entryId: ENTRY_2, isReserve: false, name: "Free Agent Fred", teamName: "Free Agent" },
];

const teams = [
  { id: TEAM_1, name: "Red Bull", primaryCount: 2 },
  { id: TEAM_2, name: "Alpine", primaryCount: 1 },
];

const sessions = [
  { date: "2025-06-01", id: SESSION_1, label: "Round 8 - Circuit A · 1 Jun 2025" },
];

function mockFetch(transferOk = true) {
  return vi.fn((url: string) => {
    if (url === "/api/csrf") {
      return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
    }
    return Promise.resolve(
      new Response(JSON.stringify(transferOk ? { ok: true } : { error: "Transfer failed" }), {
        status: transferOk ? 200 : 422,
      }),
    );
  });
}

describe("TransferForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows (Free Agent) for a rostered driver with no active stint (B5)", () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<TransferForm drivers={drivers} leagueId="league-1" sessions={sessions} teams={teams} />);

    expect(screen.getByText("Free Agent Fred (Free Agent)")).toBeInTheDocument();
  });

  it("disables a full team for a primary driver but not for a reserve (M10a)", () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<TransferForm drivers={drivers} leagueId="league-1" sessions={sessions} teams={teams} />);

    const fullOption = screen.getByRole("option", { name: "Red Bull (2/2 — full)" }) as HTMLOptionElement;
    expect(fullOption.disabled).toBe(true);
  });

  it("only shows the remove-from-league checkbox when no destination team is chosen", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const user = userEvent.setup();
    render(<TransferForm drivers={drivers} leagueId="league-1" sessions={sessions} teams={teams} />);

    expect(screen.getByLabelText(/Also remove driver from the league roster/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/New Team/), TEAM_2);
    expect(screen.queryByLabelText(/Also remove driver from the league roster/)).not.toBeInTheDocument();
  });

  it("review step summarizes the transfer, then confirm posts remove_from_league=false for a team change", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const user = userEvent.setup();
    render(<TransferForm drivers={drivers} leagueId="league-1" sessions={sessions} teams={teams} />);

    await user.selectOptions(screen.getByLabelText("Driver"), ENTRY_1);
    await user.selectOptions(screen.getByLabelText("Effective From"), SESSION_1);
    await user.selectOptions(screen.getByLabelText(/New Team/), TEAM_2);
    await user.click(screen.getByRole("button", { name: "Review Transfer" }));

    expect(
      screen.getByText("Max Verstappen: Red Bull (until 1 Jun 2025) → Alpine"),
    ).toBeInTheDocument();
    // K1 — the review stage replaces the form's fields; focus should follow
    // onto the new region instead of staying wherever "Review Transfer" was.
    expect(screen.getByText("Review Transfer").parentElement).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Confirm Transfer" }));

    const postCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]) => url === "/api/admin/leagues/league-1/transfers",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body);
    expect(body).toMatchObject({
      driver_entry_id: ENTRY_1,
      effective_date: "2025-06-01",
      new_team_id: TEAM_2,
      remove_from_league: false,
    });

    expect(await screen.findByText(/Transfer recorded:/)).toBeInTheDocument();
  });

  it("sends remove_from_league=true only when the checkbox is checked for a free-agent departure", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const user = userEvent.setup();
    render(<TransferForm drivers={drivers} leagueId="league-1" sessions={sessions} teams={teams} />);

    await user.selectOptions(screen.getByLabelText("Driver"), ENTRY_1);
    await user.selectOptions(screen.getByLabelText("Effective From"), SESSION_1);
    await user.click(screen.getByLabelText(/Also remove driver from the league roster/));
    await user.click(screen.getByRole("button", { name: "Review Transfer" }));

    expect(
      screen.getByText("Max Verstappen: Red Bull (until 1 Jun 2025) → Free Agent, leaving league"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm Transfer" }));

    const postCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]) => url === "/api/admin/leagues/league-1/transfers",
    );
    const body = JSON.parse(postCall![1].body);
    expect(body).toMatchObject({ new_team_id: null, remove_from_league: true });
  });

  it("Back returns to the form without submitting", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<TransferForm drivers={drivers} leagueId="league-1" sessions={sessions} teams={teams} />);

    await user.selectOptions(screen.getByLabelText("Driver"), ENTRY_1);
    await user.selectOptions(screen.getByLabelText("Effective From"), SESSION_1);
    await user.click(screen.getByRole("button", { name: "Review Transfer" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByLabelText("Driver")).toBeInTheDocument();
    // K1 — the review stage (and its "Back" button) unmounts on Back; focus
    // must land on the form again instead of falling back to <body>.
    expect(screen.getByLabelText("Driver").closest('[tabindex="-1"]')).toHaveFocus();
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/admin/leagues/league-1/transfers"),
    ).toBe(false);
  });
});
