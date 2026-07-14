import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

import { AddOfficialTeamsButton } from "@/components/admin/AddOfficialTeamsButton";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

function stubFetch(teamsResponse: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/api/csrf"
        ? Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))
        : Promise.resolve(teamsResponse),
    ),
  );
}

async function clickButton() {
  const button = await screen.findByRole("button", { name: /add official teams/i });
  await waitFor(() => expect(button).not.toBeDisabled());
  await userEvent.click(button);
  return button;
}

describe("AddOfficialTeamsButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to the official-teams endpoint with CSRF, reports the count, and refreshes", async () => {
    stubFetch(new Response(JSON.stringify({ added: 3 }), { status: 201 }));
    render(<AddOfficialTeamsButton leagueId="league-1" />);

    await clickButton();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/leagues/league-1/teams/official",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-csrf-token": "test-token" }),
        }),
      ),
    );
    expect(await screen.findByText("Added 3 official teams.")).toBeInTheDocument();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("shows the server message when nothing was added", async () => {
    stubFetch(new Response(JSON.stringify({ added: 0, message: "All official teams are already added (or the league is full)." })));
    render(<AddOfficialTeamsButton leagueId="league-1" />);

    await clickButton();

    expect(await screen.findByText(/already added/i)).toBeInTheDocument();
  });

  it("shows an error and does not refresh when the request fails", async () => {
    stubFetch(new Response(JSON.stringify({ error: "Failed to add official teams" }), { status: 500 }));
    render(<AddOfficialTeamsButton leagueId="league-1" />);

    await clickButton();

    expect(await screen.findByText("Failed to add official teams")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
