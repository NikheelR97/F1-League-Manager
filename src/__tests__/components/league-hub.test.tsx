import { render, screen } from "@testing-library/react";

import { LeagueHub } from "@/components/league/LeagueHub";
import { RaceCountdown } from "@/components/league/RaceCountdown";
import { getLeagueSummaries } from "@/lib/ui/league-data";

describe("LeagueHub", () => {
  it("renders meaningful league hub data", () => {
    render(<LeagueHub slug="standard" />);

    expect(
      screen.getByRole("heading", { name: "Standard League" }),
    ).toBeInTheDocument();
    expect(screen.getByText("50% feature race")).toBeInTheDocument();
    expect(screen.getByText("Wheel pending")).toBeInTheDocument();
  });

  it("renders countdown states", () => {
    render(
      <RaceCountdown
        now={new Date("2026-05-07T10:00:00.000Z")}
        targetIso="2026-05-08T12:30:00.000Z"
      />,
    );

    expect(screen.getByText("1d 2h 30m")).toBeInTheDocument();
  });

  it("uses local project images for league hero assets", () => {
    const summaries = getLeagueSummaries();

    expect.assertions(summaries.length);
    for (const league of summaries) {
      expect(league.heroImage).toMatch(/^\/images\/leagues\//u);
    }
  });
});
