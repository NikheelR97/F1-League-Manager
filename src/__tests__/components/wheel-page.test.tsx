/**
 * R5 — the public wheel history page should explain what "the wheel" is
 * before a newcomer sees any spins (or none at all).
 */
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/public/resolve-league", () => ({
  resolvePublicLeague: vi.fn(),
}));

import LeagueWheelHistoryPage from "@/app/leagues/[slug]/wheel/page";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const league = {
  id: "league-1",
  name: "Standard League",
  slug: "standard",
  format: "standard",
  status: "active",
  fastest_lap_enabled: true,
  pole_position_enabled: true,
  constructor_championship_enabled: true,
  penalty_threshold: 12,
  logo_path: null,
  hero_image_path: null,
  season: { id: "season-1", name: "Season 1" },
};

function mockSpins(data: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error: null }),
  };
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>);
}

describe("LeagueWheelHistoryPage", () => {
  it("explains what the wheel does when no spins have been confirmed yet", async () => {
    vi.mocked(resolvePublicLeague).mockResolvedValue(league);
    mockSpins([]);

    render(
      await LeagueWheelHistoryPage({ params: Promise.resolve({ slug: "standard" }) }),
    );

    expect(screen.getByText("No wheel spins yet")).toBeInTheDocument();
    expect(
      screen.getByText(/randomly draws the next circuit from this league's remaining pool/i),
    ).toBeInTheDocument();
  });

  it("renders an empty state instead of crashing when the league has no current season", async () => {
    vi.mocked(resolvePublicLeague).mockResolvedValue({ ...league, season: null });

    render(
      await LeagueWheelHistoryPage({ params: Promise.resolve({ slug: "standard" }) }),
    );

    expect(screen.getByText("No season yet")).toBeInTheDocument();
  });
});
