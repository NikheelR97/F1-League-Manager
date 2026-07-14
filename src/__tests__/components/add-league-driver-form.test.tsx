import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

import { AddLeagueDriverForm } from "@/components/admin/AddLeagueDriverForm";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const drivers = [{ display_name: "Driver One", id: "driver-1", racing_number: 44 }];
const teams = [{ color_hex: "#ffffff", id: "team-1", name: "Team One" }];

describe("AddLeagueDriverForm reserve hint (F4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("shows a hint under the Reserve driver checkbox explaining team assignment still applies", () => {
    // F4 — the "Reserve driver" checkbox had no explanation of what reserve
    // status means (a home team is still required; reserves get assigned
    // per-race during result entry). Pre-fix, this text does not exist.
    render(<AddLeagueDriverForm drivers={drivers} leagueId="league-1" teams={teams} />);

    expect(
      screen.getByText(/a home team is still required/i),
    ).toBeInTheDocument();
  });
});

describe("AddLeagueDriverForm create new driver link (S13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("renders a link to create a new driver", () => {
    render(<AddLeagueDriverForm drivers={drivers} leagueId="league-1" teams={teams} />);

    const link = screen.getByRole("link", { name: /Create a new driver/i });
    expect(link).toHaveAttribute("href", "/admin/drivers/new");
  });
});

// Zod validates driver_id/team_id as UUIDs, so the submit tests need
// schema-valid ids (unlike the render-only tests above).
const uuidDrivers = [
  { display_name: "Driver One", id: "11111111-1111-4111-8111-111111111111", racing_number: 44 },
];
const uuidTeams = [
  { color_hex: "#ffffff", id: "22222222-2222-4222-8222-222222222222", name: "Team One" },
];

describe("AddLeagueDriverForm submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillAndSelect() {
    await userEvent.selectOptions(screen.getByLabelText("Driver"), uuidDrivers[0].id);
    await userEvent.selectOptions(screen.getByLabelText("Team"), uuidTeams[0].id);
  }

  it("posts the new entry and navigates back to the league on success", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AddLeagueDriverForm drivers={uuidDrivers} leagueId="league-1" teams={uuidTeams} />);
    await fillAndSelect();
    await userEvent.click(screen.getByRole("button", { name: /add to league/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/leagues/league-1/drivers",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/leagues/league-1"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows a root error message when the request fails", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Driver already on a team" }), { status: 400 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AddLeagueDriverForm drivers={uuidDrivers} leagueId="league-1" teams={uuidTeams} />);
    await fillAndSelect();
    await userEvent.click(screen.getByRole("button", { name: /add to league/i }));

    expect(await screen.findByText("Driver already on a team")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
