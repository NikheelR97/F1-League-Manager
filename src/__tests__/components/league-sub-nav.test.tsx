import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { LeagueSubNav } from "@/components/league/LeagueSubNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/leagues/test-league/hub",
}));

describe("LeagueSubNav", () => {
  it("renders wheel tab for wheel league", () => {
    render(<LeagueSubNav slug="test-league" isWheelLeague={true} />);
    expect(screen.getByText("Wheel")).toBeInTheDocument();
  });

  it("omits wheel tab for non-wheel league", () => {
    render(<LeagueSubNav slug="test-league" isWheelLeague={false} />);
    expect(screen.queryByText("Wheel")).not.toBeInTheDocument();
  });

  it("always renders all other navigation tabs", () => {
    render(<LeagueSubNav slug="test-league" isWheelLeague={false} />);
    expect(screen.getByText("Hub")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Standings")).toBeInTheDocument();
    expect(screen.getByText("Results")).toBeInTheDocument();
    expect(screen.getByText("Penalties")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();
  });

  it("renders correct links with proper href attributes", () => {
    render(<LeagueSubNav slug="my-league" isWheelLeague={true} />);
    const hubLink = screen.getByText("Hub").closest("a");
    const wheelLink = screen.getByText("Wheel").closest("a");

    expect(hubLink).toHaveAttribute("href", "/leagues/my-league");
    expect(wheelLink).toHaveAttribute("href", "/leagues/my-league/wheel");
  });
});
