import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import Home from "@/app/page";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

interface ChainOptions {
  list?: unknown;
  single?: unknown;
}

function makeChain({ list = null, single = null }: ChainOptions) {
  const chain: Record<string, unknown> = { data: list, error: null };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: single, error: null });
  return chain;
}

function mockTables(tables: Record<string, unknown>) {
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({
    from: vi.fn((table: string) => tables[table]),
  } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>);
}

describe("Home page", () => {
  it("renders real leagues with published standings and a scheduled race", async () => {
    mockTables({
      leagues: makeChain({
        list: [
          {
            id: "league-1",
            name: "Standard League",
            slug: "standard",
            format: "standard",
            status: "active",
            season_id: "season-1",
          },
          {
            id: "league-2",
            name: "Informal League",
            slug: "informal",
            format: "informal",
            status: "active",
            season_id: "season-2",
          },
        ],
      }),
      driver_standings: makeChain({
        single: { total_points: 25, drivers: { display_name: "Max Verstappen" } },
      }),
      team_standings: makeChain({
        single: { total_points: 43, teams: { name: "Red Bull" } },
      }),
      race_sessions: makeChain({
        single: { name: "Round 1", circuits: { name: "Bahrain" } },
      }),
    });

    render(await Home());

    expect(
      screen.getByRole("heading", { name: "F1 Esports League Manager" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard League" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Informal League" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open League" })).toHaveLength(2);
    expect(screen.getAllByText(/Bahrain/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Max Verstappen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Red Bull").length).toBeGreaterThan(0);
  });

  it("falls back to TBD when a league has no scheduled race or standings yet", async () => {
    mockTables({
      leagues: makeChain({
        list: [
          {
            id: "league-3",
            name: "New League",
            slug: "new-league",
            format: "custom",
            status: "active",
            season_id: "season-3",
          },
        ],
      }),
      driver_standings: makeChain({ single: null }),
      team_standings: makeChain({ single: null }),
      race_sessions: makeChain({ single: null }),
    });

    render(await Home());

    expect(screen.getByRole("heading", { name: "New League" })).toBeInTheDocument();
    expect(screen.getByText("TBD")).toBeInTheDocument();
    expect(screen.getAllByText("No results yet")).toHaveLength(2);
  });

  it("renders no league cards when there are no published leagues", async () => {
    mockTables({ leagues: makeChain({ list: [] }) });

    render(await Home());

    expect(
      screen.getByRole("heading", { name: "F1 Esports League Manager" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("link", { name: "Open League" })).toHaveLength(0);
  });
});
