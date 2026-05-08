import { render, screen } from "@testing-library/react";

import { LeagueHub } from "@/components/league/LeagueHub";
import { RaceCountdown } from "@/components/league/RaceCountdown";
import type { PublicLeague } from "@/lib/public/resolve-league";
import { getLeagueSummaries } from "@/lib/ui/league-data";

const mockLeague: PublicLeague = {
  id: "league-1",
  name: "Standard League",
  slug: "standard",
  format: "feature",
  status: "active",
  fastest_lap_enabled: true,
  pole_position_enabled: true,
  constructor_championship_enabled: true,
  penalty_threshold: 12,
  logo_path: null,
  hero_image_path: null,
  season: { id: "season-1", name: "Season 2" },
};

const baseProps = {
  league: mockLeague,
  nextRace: null,
  latestSession: null,
  topDrivers: [],
  topConstructors: [],
  penaltyAlerts: [],
};

describe("LeagueHub", () => {
  it("renders the league name as a heading", () => {
    render(<LeagueHub {...baseProps} />);
    expect(
      screen.getByRole("heading", { name: /Standard League/i }),
    ).toBeInTheDocument();
  });

  it("renders the season name", () => {
    render(<LeagueHub {...baseProps} />);
    expect(screen.getAllByText(/Season 2/i).length).toBeGreaterThan(0);
  });

  it("shows next race section when a race is scheduled", () => {
    render(
      <LeagueHub
        {...baseProps}
        nextRace={{
          id: "session-1",
          name: "Round 1 — Bahrain",
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
          circuits: { name: "Bahrain", country: "Bahrain" },
        }}
      />,
    );
    expect(screen.getByText(/Next Race/i)).toBeInTheDocument();
  });

  it("shows top 5 drivers section when drivers are present", () => {
    render(
      <LeagueHub
        {...baseProps}
        topDrivers={[
          {
            position: 1,
            previous_position: null,
            total_points: 150,
            wins: 3,
            drivers: { id: "driver-1", display_name: "Max Verstappen", racing_number: 1 },
            teams: { id: "team-1", name: "Red Bull", color_hex: "#1E41FF" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Max Verstappen")).toBeInTheDocument();
    expect(screen.getByText("150 pts")).toBeInTheDocument();
  });

  it("shows penalty alerts section when threshold-reached drivers are present", () => {
    render(
      <LeagueHub
        {...baseProps}
        penaltyAlerts={[
          {
            driver_id: "00000000-0000-4000-8000-000000000099",
            penalty_points: 12,
            drivers: { display_name: "Test Driver" },
          },
        ]}
      />,
    );
    expect(screen.getByText(/Penalty Watch/i)).toBeInTheDocument();
    expect(screen.getByText("Test Driver")).toBeInTheDocument();
  });

  it("renders countdown states correctly", () => {
    render(
      <RaceCountdown
        now={new Date("2026-05-07T10:00:00.000Z")}
        targetIso="2026-05-08T12:30:00.000Z"
      />,
    );

    expect(screen.getByText("1d 2h 30m")).toBeInTheDocument();
  });

  it("shows constructor standings when constructor championship is enabled with data", () => {
    render(
      <LeagueHub
        {...baseProps}
        topConstructors={[
          {
            position: 1,
            previous_position: null,
            total_points: 200,
            wins: 5,
            teams: { id: "team-2", name: "Ferrari", color_hex: "#DC0000" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Ferrari")).toBeInTheDocument();
    expect(screen.getByText("200 pts")).toBeInTheDocument();
  });

  it("shows latest result in context bar when latestSession is provided", () => {
    render(
      <LeagueHub
        {...baseProps}
        latestSession={{
          id: "session-5",
          name: "Round 5 — Monaco",
          race_number: 1,
          published_at: "2026-05-07T18:00:00.000Z",
          circuits: { name: "Monaco", country: "Monaco" },
        }}
      />,
    );
    expect(screen.getByText(/Last result: Monaco/i)).toBeInTheDocument();
  });

  it("uses uploaded league hero images when configured", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    render(
      <LeagueHub
        {...baseProps}
        league={{ ...mockLeague, hero_image_path: "leagues/league-1/hero_image.webp" }}
      />,
    );

    expect(screen.getByAltText("Standard League hero").getAttribute("src")).toContain(
      "storage",
    );

    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
  });

  it("uses local project images for league hero assets", () => {
    const summaries = getLeagueSummaries();

    expect.assertions(summaries.length);
    for (const league of summaries) {
      expect(league.heroImage).toMatch(/^\/images\/leagues\//u);
    }
  });
});
