// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public/resolve-league", () => ({
  resolvePublicLeague: vi.fn(async (slug: string) =>
    slug === "x" ? { id: "l", name: "Thursday League", season: { id: "s", name: "Season 1" }, slug } : null,
  ),
}));
vi.mock("@/lib/public/round-summary", () => ({
  loadRoundSummary: vi.fn(async () => ({
    nextSession: { circuit: "Jeddah", scheduled_at: "2026-12-03T19:00:00Z" },
    summary: {
      driverRoundPoints: new Map(),
      movers: { down: [{ delta: -1, name: "B" }], up: [{ delta: 1, name: "A" }] },
      podium: [
        { driverName: "A", points: 25, position: 1 },
        { driverName: "B", points: 18, position: 2 },
        { driverName: "C", points: 15, position: 3 },
      ],
      roundName: "Abu Dhabi GP",
      roundNumber: 19,
      teamRoundPoints: new Map(),
    },
  })),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => {
      const q = {
        eq: () => q,
        limit: () => q,
        order: () => q,
        select: () => q,
        then: (res: (v: unknown) => unknown) =>
          Promise.resolve({
            data: [{ drivers: { display_name: "A" }, position: 1, teams: { color_hex: "#fff", name: "T" }, total_points: 264 }],
          }).then(res),
      };
      return q;
    },
  }),
}));

import { GET } from "@/app/leagues/[slug]/recap/image.png/route";

describe("recap image route", () => {
  it("renders a PNG", { timeout: 60000 }, async () => {
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ slug: "x" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const buf = Buffer.from(await res.arrayBuffer());
    if (process.env.RECAP_OUT) (await import("node:fs")).writeFileSync(process.env.RECAP_OUT, buf);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("404s for an unknown league", async () => {
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });
});
