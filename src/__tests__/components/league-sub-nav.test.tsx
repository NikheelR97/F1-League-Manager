import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

import { LeagueSubNav } from "@/components/league/LeagueSubNav";

let pathname = "/leagues/test-league";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("LeagueSubNav", () => {
  beforeEach(() => {
    pathname = "/leagues/test-league";
  });

  it("renders the five top-level tabs", () => {
    render(<LeagueSubNav slug="test-league" isWheelLeague={true} />);
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(links).toEqual(["Hub", "Standings", "Results", "Calendar", "Stats"]);
  });

  it("links Standings to the overview page", () => {
    render(<LeagueSubNav slug="my-league" isWheelLeague={false} />);
    expect(screen.getByRole("link", { name: "Standings" })).toHaveAttribute("href", "/leagues/my-league/standings");
    expect(screen.getByRole("link", { name: "Hub" })).toHaveAttribute("href", "/leagues/my-league");
  });

  it("shows Penalties under Results and keeps Results active on the penalties page", () => {
    pathname = "/leagues/test-league/penalties";
    render(<LeagueSubNav slug="test-league" isWheelLeague={false} />);
    expect(screen.getByRole("link", { name: "Penalties" })).toHaveAttribute("href", "/leagues/test-league/penalties");
    expect(screen.getAllByRole("link", { name: "Results" })[0]).toHaveAttribute("aria-current", "page");
  });

  it("shows Wheel under Calendar only for wheel leagues", () => {
    pathname = "/leagues/test-league/wheel";
    const { unmount } = render(<LeagueSubNav slug="test-league" isWheelLeague={true} />);
    expect(screen.getByRole("link", { name: "Wheel" })).toHaveAttribute("href", "/leagues/test-league/wheel");
    expect(screen.getAllByRole("link", { name: "Calendar" })[0]).toHaveAttribute("aria-current", "page");
    unmount();

    pathname = "/leagues/test-league/calendar";
    render(<LeagueSubNav slug="test-league" isWheelLeague={false} />);
    expect(screen.queryByRole("link", { name: "Wheel" })).not.toBeInTheDocument();
  });
});
