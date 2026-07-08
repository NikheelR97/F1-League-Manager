import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
