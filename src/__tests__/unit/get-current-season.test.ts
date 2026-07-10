import { vi } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentSeason } from "@/lib/leagues/get-current-season";

function makeChain(result: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe("getCurrentSeason", () => {
  it("returns the league's current season row", async () => {
    const season = { id: "s1", name: "Season 1", starts_on: "2025-01-01", ends_on: null, is_current: true };
    const chain = makeChain({ data: season, error: null });
    const db = chain as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;

    const result = await getCurrentSeason(db, "league-1");

    expect(result).toEqual(season);
    expect(chain.from).toHaveBeenCalledWith("seasons");
    expect(chain.eq).toHaveBeenCalledWith("league_id", "league-1");
    expect(chain.eq).toHaveBeenCalledWith("is_current", true);
  });

  it("returns null when the league has no current season", async () => {
    const chain = makeChain({ data: null, error: null });
    const db = chain as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;

    const result = await getCurrentSeason(db, "league-1");

    expect(result).toBeNull();
  });

  it("throws on a genuine database error (bubbles to withAdminGuard's 500 handler)", async () => {
    const chain = makeChain({ data: null, error: { message: "connection reset" } });
    const db = chain as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;

    await expect(getCurrentSeason(db, "league-1")).rejects.toMatchObject({ message: "connection reset" });
  });
});
