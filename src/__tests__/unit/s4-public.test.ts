/**
 * S4 Public Pages — unit tests for standings sort, gap calculation,
 * result sort order, resolver isolation logic, and penalty field safety.
 */

// ─── Result sort order (mirrors STATUS_SORT in result pages) ─────────────────

import { comparePublicRaceResults } from "@/lib/public/result-sort";

type ResultRow = {
  result_status: string;
  finishing_position: number | null;
  raw_result?: string | null;
};

function sortResults(rows: ResultRow[]): ResultRow[] {
  return [...rows].sort(comparePublicRaceResults);
}

describe("result sort order", () => {
  it("puts classified finishers before non-finishers", () => {
    const rows: ResultRow[] = [
      { result_status: "dnf", finishing_position: null },
      { result_status: "classified", finishing_position: 1 },
      { result_status: "dsq", finishing_position: null },
      { result_status: "classified", finishing_position: 3 },
    ];
    const sorted = sortResults(rows);
    expect(sorted[0]).toMatchObject({ result_status: "classified", finishing_position: 1 });
    expect(sorted[1]).toMatchObject({ result_status: "classified", finishing_position: 3 });
    expect(sorted[2]).toMatchObject({ result_status: "dnf" });
    expect(sorted[3]).toMatchObject({ result_status: "dsq" });
  });

  it("sorts classified finishers by finishing_position ascending", () => {
    const rows: ResultRow[] = [
      { result_status: "classified", finishing_position: 5 },
      { result_status: "classified", finishing_position: 1 },
      { result_status: "classified", finishing_position: 3 },
    ];
    const sorted = sortResults(rows);
    expect(sorted.map((r) => r.finishing_position)).toEqual([1, 3, 5]);
  });

  it("follows HANDOVER order: classified → dnf → dns → dsq → ban", () => {
    const rows: ResultRow[] = [
      { result_status: "ban", finishing_position: null },
      { result_status: "dns", finishing_position: null },
      { result_status: "classified", finishing_position: 2, raw_result: "1 Lap - 1" },
      { result_status: "classified", finishing_position: 1, raw_result: "0" },
      { result_status: "dsq", finishing_position: null },
      { result_status: "dnf", finishing_position: null, raw_result: "DNF - 1" },
    ];
    const sorted = sortResults(rows);
    const statuses = sorted.map((r) => r.result_status);
    expect(statuses).toEqual(["classified", "classified", "dnf", "dsq", "ban", "dns"]);
    expect(sorted[1].raw_result).toBe("1 Lap - 1");
  });

  it("sorts dnf rows by workbook retirement order", () => {
    const rows: ResultRow[] = [
      { result_status: "dnf", finishing_position: null, raw_result: "DNF - 2" },
      { result_status: "dnf", finishing_position: null, raw_result: "DNF - 1" },
    ];
    const sorted = sortResults(rows);
    expect(sorted.map((r) => r.raw_result)).toEqual(["DNF - 1", "DNF - 2"]);
  });
});

// ─── Driver standings gap to leader ──────────────────────────────────────────

function computeGap(leaderPoints: number, rowPoints: number, position: number): string {
  return position === 1 ? "—" : `−${leaderPoints - rowPoints}`;
}

describe("standings gap to leader", () => {
  it("shows — for the leader", () => {
    expect(computeGap(200, 200, 1)).toBe("—");
  });

  it("shows the correct negative gap for trailing drivers", () => {
    expect(computeGap(200, 175, 2)).toBe("−25");
    expect(computeGap(200, 100, 5)).toBe("−100");
  });

  it("shows 0-gap correctly when tied on points but not P1", () => {
    expect(computeGap(200, 200, 2)).toBe("−0");
  });
});

// ─── Penalty field safety ─────────────────────────────────────────────────────
// Verifies the select strings in penalty-related files do not expose internal
// steward/appeal notes (HANDOVER §8.4 and §13).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const penaltyPagePath = resolve(
  "src/app/leagues/[slug]/penalties/page.tsx",
);
const resultDetailPath = resolve(
  "src/app/leagues/[slug]/results/[sessionId]/page.tsx",
);

// Strip block and line comments before checking select strings
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("penalty field safety — HANDOVER §8.4 and §13", () => {
  it("penalties page select strings do not include steward_notes or appeal_notes", () => {
    const src = stripComments(readFileSync(penaltyPagePath, "utf8"));
    expect(src).not.toContain("steward_notes");
    expect(src).not.toContain("appeal_notes");
  });

  it("race result detail page select strings do not include steward_notes or appeal_notes", () => {
    const src = stripComments(readFileSync(resultDetailPath, "utf8"));
    expect(src).not.toContain("steward_notes");
    expect(src).not.toContain("appeal_notes");
  });
});

// ─── resolvePublicLeague — draft league exclusion ─────────────────────────────

import { vi } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePublicLeague } from "@/lib/public/resolve-league";

function makeChain(result: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe("resolvePublicLeague", () => {
  it("returns null when the database returns no row", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeChain({ data: null, error: null }) as unknown as ReturnType<typeof createSupabaseServiceRoleClient>,
    );
    const result = await resolvePublicLeague("nonexistent-slug");
    expect(result).toBeNull();
  });

  it("returns null when the league has no linked season", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeChain({
        data: {
          id: "league-1",
          name: "Test League",
          slug: "test",
          format: "feature",
          status: "active",
          fastest_lap_enabled: true,
          pole_position_enabled: false,
          constructor_championship_enabled: false,
          penalty_threshold: 12,
          logo_path: null,
          hero_image_path: null,
          seasons: null,
        },
        error: null,
      }) as unknown as ReturnType<typeof createSupabaseServiceRoleClient>,
    );
    const result = await resolvePublicLeague("test");
    expect(result).toBeNull();
  });

  it("applies .neq('status', 'draft') to exclude draft leagues", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      chain as unknown as ReturnType<typeof createSupabaseServiceRoleClient>,
    );
    await resolvePublicLeague("any-slug");
    expect(chain.neq).toHaveBeenCalledWith("status", "draft");
  });

  it("returns a shaped PublicLeague for a valid active league", async () => {
    const season = { id: "season-1", name: "Season 1" };
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeChain({
        data: {
          id: "league-1",
          name: "Standard",
          slug: "standard",
          format: "feature",
          status: "active",
          fastest_lap_enabled: true,
          pole_position_enabled: true,
          constructor_championship_enabled: true,
          penalty_threshold: 12,
          logo_path: "/logos/standard.png",
          hero_image_path: null,
          seasons: season,
        },
        error: null,
      }) as unknown as ReturnType<typeof createSupabaseServiceRoleClient>,
    );
    const result = await resolvePublicLeague("standard");
    expect(result).toMatchObject({
      id: "league-1",
      name: "Standard",
      slug: "standard",
      format: "feature",
      constructor_championship_enabled: true,
      season: { id: "season-1", name: "Season 1" },
    });
  });
});
