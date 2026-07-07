/**
 * Results publish pipeline E2E — audit4 findings E1/E2/E3 (scoring pipeline).
 *
 * Strategy A (dev docs/audit4 e2e-test-design.md): publishes the seeded
 * Informal League "Round 2 — Australia" session end-to-end via the admin API
 * and asserts EXACT public standings/points numbers. This is a
 * `describe.serial` block that owns the Informal League's standings for the
 * rest of the run.
 *
 * Decisive seed fact: `driver_standings` are seeded as static snapshots with
 * no backing `race_results` rows (Bahrain is "completed" but has zero result
 * rows), so the first publish/recalculate discards the seeded snapshot and
 * rebuilds standings from only the newly-published session — deterministic.
 *
 * Prerequisites: `npm run seed:e2e`, global-setup admin auth state.
 */

import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

test.use({ storageState: ADMIN_STORAGE_STATE });

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const INFORMAL_LEAGUE_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const AUSTRALIA_SESSION_ID = "09eebc99-9c0b-4ef8-bb6d-6bb9bd380a12";
const PUBLISH_URL = `/api/admin/sessions/${AUSTRALIA_SESSION_ID}/publish`;

// Seed order (supabase/seed.sql L64-73 drivers, L119-134 stints) — the 10
// Informal League drivers pinned to their seeded team, in the order the
// design doc assigns finishing positions 1..10.
const GRID = [
  { name: "Alessandro Ferrari", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
  { name: "Marco Rossi", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
  { name: "Carlos Martinez", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12" },
  { name: "Pierre Dupont", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12" },
  { name: "Hans Mueller", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13" },
  { name: "James Wilson", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13" },
  { name: "Luca Brambilla", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14" },
  { name: "Sofia Andersen", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14" },
  { name: "Kenji Tanaka", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15" },
  { name: "Emma Clarke", driver_id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20", team_id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15" },
] as const;

// GRID indices in finishing-position order (order[0] finishes P1).
const ORIGINAL_ORDER = GRID.map((_, i) => i); // P1..P10 = grid order as-is
const SWAPPED_ORDER = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9]; // P1/P2 swapped — see finding F6

// Points column is the 5th <td> (Pos, Δ, Driver, Team, Pts, Gap, W, Pod, FL).
const POINTS_COLUMN = 4;

async function csrfHeaders(request: APIRequestContext) {
  const res = await request.get("/api/csrf");
  const { token } = (await res.json()) as { token: string };
  // Admin API guard requires x-csrf-token + a matching Origin header on every
  // mutating request (src/lib/admin/api-guard.ts L57-67); Playwright's
  // request context doesn't send Origin automatically like a browser does.
  return { "x-csrf-token": token, origin: BASE_URL };
}

// `order` is a list of GRID indices in finishing order (order[0] finishes P1).
function publishBody(order: number[], fastestLapGridIdx: number, republish = false) {
  return {
    league_id: INFORMAL_LEAGUE_ID,
    qualifying: [
      { driver_id: GRID[0].driver_id, team_id: GRID[0].team_id, qualifying_position: 1, is_pole: true },
    ],
    results: order.map((gridIdx, i) => ({
      driver_id: GRID[gridIdx].driver_id,
      team_id: GRID[gridIdx].team_id,
      finishing_position: i + 1,
      result_status: "classified" as const,
      fastest_lap: gridIdx === fastestLapGridIdx,
      manual_points_adjustment: 0,
      raw_result: null,
      notes: null,
    })),
    penalties: [] as unknown[],
    republish,
  };
}

function driverRow(page: Page, driverName: string): Locator {
  return page.locator(`table tbody tr[data-driver-name="${driverName.toLowerCase()}"]`);
}

// Standings reads go through unstable_cache (revalidateTag on publish is
// stale-while-revalidate, not a synchronous purge — see the comment on
// src/app/leagues/[slug]/standings/drivers/page.tsx). Poll instead of a
// single hard read so a ~1-2s post-publish staleness window doesn't flake
// the assertion.
async function waitForStandingsCell(
  page: Page,
  driverName: string,
  expected: string,
  timeoutMs = 10_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.goto("/leagues/informal/standings/drivers");
        return driverRow(page, driverName).locator("td").nth(POINTS_COLUMN).textContent();
      },
      { timeout: timeoutMs },
    )
    .toBe(expected);
}

async function standingsPointsColumn(page: Page): Promise<number[]> {
  const cells = await page.locator("table tbody tr td:nth-child(5)").allTextContents();
  return cells.map(Number);
}

test.describe.serial("Results publish pipeline (Informal League — Australia session)", () => {
  test("T1: publish Australia end-to-end lands exact points on public pages", async ({ page, request }) => {
    const headers = await csrfHeaders(request);

    const res = await request.post(PUBLISH_URL, { headers, data: publishBody(ORIGINAL_ORDER, 0) });
    expect(res.status()).toBe(200);

    // Poll on Marco Rossi, not Ferrari: the seeded static snapshot already
    // has Ferrari at 26 pts (coincidentally the same as the freshly
    // computed value), so polling Ferrari can't detect a stale cache read.
    // Rossi's seeded snapshot value (8, position 6) differs from the
    // computed value (18, position 2) and so reliably distinguishes stale
    // from fresh.
    await waitForStandingsCell(page, "Marco Rossi", "18");

    const expected: [string, number][] = [
      ["Alessandro Ferrari", 26],
      ["Marco Rossi", 18],
      ["Carlos Martinez", 15],
      ["Pierre Dupont", 12],
      ["Hans Mueller", 10],
      ["James Wilson", 8],
      ["Luca Brambilla", 6],
      ["Sofia Andersen", 4],
      ["Kenji Tanaka", 2],
      ["Emma Clarke", 1],
    ];
    for (const [name, points] of expected) {
      await expect(driverRow(page, name).locator("td").nth(POINTS_COLUMN)).toHaveText(String(points));
    }
    await expect(driverRow(page, "Alessandro Ferrari").locator("td").nth(0)).toHaveText("1");

    // Public result detail: finish order P1..P10 + fastest-lap marker.
    await page.goto(`/leagues/informal/results/${AUSTRALIA_SESSION_ID}`);
    const raceSection = page.locator("section", { hasText: "Race Result" });
    const firstRow = raceSection.locator("tbody tr").first();
    const lastRow = raceSection.locator("tbody tr").last();
    await expect(firstRow).toContainText("Alessandro Ferrari");
    await expect(firstRow).toContainText("26");
    await expect(firstRow).toContainText("FL");
    await expect(lastRow).toContainText("Emma Clarke");
  });

  // FINDING F6 (discovered by this test, not in the original design doc):
  // `race_results` has `unique (race_session_id, finishing_position)` in
  // addition to the upsert's conflict target `(race_session_id, driver_id)`
  // (supabase/migrations/20260507161000_s1_core_schema.sql L215-216, neither
  // column marked DEFERRABLE). Supabase applies a multi-row upsert as one
  // batched INSERT ... ON CONFLICT DO UPDATE, and Postgres validates the
  // non-target unique constraint per row as it goes. Swapping two drivers'
  // finishing positions (Rossi -> P1, Ferrari -> P2) means one row's new
  // position collides with the other row's not-yet-updated old position
  // mid-statement, so the second POST body 500s with "Failed to save race
  // results" — reproduced deterministically outside Playwright too (plain
  // fetch, same payload). This isn't a concurrency artifact: T3 below
  // republishes the SAME (unpermuted) positions concurrently and that
  // succeeds fine, because no row's target position ever collides with
  // another row's current position. A real correction that reorders the
  // podium — the exact scenario this test is designed to cover — used to 500.
  // FIXED in this wave: publish-service now delete-then-inserts qualifying_results
  // and race_results per session (matching penalties/reserve assignments), so
  // there are no pre-existing position rows for a swap to collide with.
  test(
    "T2: republish correction swaps standings without double-counting",
    async ({ page, request }) => {
      const headers = await csrfHeaders(request);

      const res = await request.post(PUBLISH_URL, { headers, data: publishBody(SWAPPED_ORDER, 1, true) });
      expect(res.status()).toBe(200);

      await waitForStandingsCell(page, "Marco Rossi", "26");
      await expect(driverRow(page, "Alessandro Ferrari").locator("td").nth(POINTS_COLUMN)).toHaveText("18");

      // Not 43 (25+18) — proves republish replaced rather than added. Sum is
      // 102, not 101: base position points 25+18+15+12+10+8+6+4+2+1=101,
      // plus the one fastest-lap bonus point (fastest_lap_enabled=true for
      // Informal League) = 102, regardless of which driver holds the FL.
      const points = await standingsPointsColumn(page);
      expect(points).toHaveLength(10);
      expect(points.reduce((sum, p) => sum + p, 0)).toBe(102);
    },
  );

  test("T3: concurrent double-publish is idempotent for standings", async ({ page, request }) => {
    const headers = await csrfHeaders(request);
    // Deliberately the SAME positions as T1 (not swapped, per F6 above) —
    // this test is about concurrency idempotency, not position permutation.
    const body = publishBody(ORIGINAL_ORDER, 0, true);

    // Fire two identical publishes concurrently. race_results upsert on
    // (session, driver) and driver_standings is a full delete-then-recalc,
    // so this should be idempotent — the invariant is checked on public
    // standings, not on which response "won" the race.
    const [res1, res2] = await Promise.all([
      request.post(PUBLISH_URL, { headers, data: body }),
      request.post(PUBLISH_URL, { headers, data: body }),
    ]);
    expect([res1.status(), res2.status()]).toContain(200);

    // Content is identical to what's already published (no permutation, see
    // above), so unlike T1 there's nothing for a stale cache read to get
    // wrong here — a plain goto is enough.
    await page.goto("/leagues/informal/standings/drivers");
    const points = await standingsPointsColumn(page);
    expect(points).toHaveLength(10);
    // 101 base position points + 1 fastest-lap bonus = 102 (see T2 comment).
    expect(points.reduce((sum, p) => sum + p, 0)).toBe(102);
    expect(Math.max(...points)).toBeLessThanOrEqual(26);
  });

  test("T18: session detail qualifying and report tabs render", async ({ page }) => {
    await page.goto(`/leagues/informal/results/${AUSTRALIA_SESSION_ID}/qualifying`);
    await expect(page.getByRole("heading", { name: /Qualifying/ })).toBeVisible();
    const poleRow = page.locator('table[aria-label="Qualifying classification"] tbody tr').first();
    await expect(poleRow).toContainText("Alessandro Ferrari");

    const reportResponse = await page.goto(`/leagues/informal/results/${AUSTRALIA_SESSION_ID}/report`);
    expect(reportResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Report/ })).toBeVisible();
    await expect(page.getByText("Race Winner")).toBeVisible();
  });

  test("T19: standings driver search filters to matching rows", async ({ page }) => {
    await page.goto("/leagues/informal/standings/drivers");
    await page.getByLabel("Find a driver...").fill("ferrari");
    await expect(driverRow(page, "Alessandro Ferrari")).not.toHaveClass(/hidden/);
    await expect(driverRow(page, "Marco Rossi")).toHaveClass(/hidden/);
  });

  test("T21: publish rejects duplicate positions, negative position, and no classified drivers", async ({ request }) => {
    const headers = await csrfHeaders(request);
    const base = { league_id: INFORMAL_LEAGUE_ID, qualifying: [] as unknown[], penalties: [] as unknown[], republish: true };

    const duplicatePositions = await request.post(PUBLISH_URL, {
      headers,
      data: {
        ...base,
        results: [
          { driver_id: GRID[0].driver_id, team_id: GRID[0].team_id, finishing_position: 1, result_status: "classified", fastest_lap: false, manual_points_adjustment: 0, raw_result: null, notes: null },
          { driver_id: GRID[1].driver_id, team_id: GRID[1].team_id, finishing_position: 1, result_status: "classified", fastest_lap: false, manual_points_adjustment: 0, raw_result: null, notes: null },
        ],
      },
    });
    expect(duplicatePositions.status()).toBe(422);

    const negativePosition = await request.post(PUBLISH_URL, {
      headers,
      data: {
        ...base,
        results: [
          { driver_id: GRID[0].driver_id, team_id: GRID[0].team_id, finishing_position: -1, result_status: "classified", fastest_lap: false, manual_points_adjustment: 0, raw_result: null, notes: null },
        ],
      },
    });
    expect(negativePosition.status()).toBe(422);

    const noneClassified = await request.post(PUBLISH_URL, {
      headers,
      data: {
        ...base,
        results: [
          { driver_id: GRID[0].driver_id, team_id: GRID[0].team_id, finishing_position: null, result_status: "dnf", fastest_lap: false, manual_points_adjustment: 0, raw_result: null, notes: null },
        ],
      },
    });
    expect(noneClassified.status()).toBe(422);
  });
});
