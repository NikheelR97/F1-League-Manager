/**
 * Season rollover E2E — permanent regression test for the season-ownership
 * flip (dev docs/SEASON_FLIP_SPRINT_PLAN.md).
 *
 * The bug this guards against: before the flip, seasons were a global/shared
 * table and "starting Season 2" had no single well-defined action — a league
 * could easily keep writing new race data into a season another league (or
 * the same league's old season) still pointed at, silently corrupting
 * standings. After the flip, seasons belong to exactly one league, carry-over
 * is THE rollover action (POST .../carry-over sets the target season current
 * on success), and the public site always defaults to a league's current
 * season while historical seasons stay reachable via `?season=`.
 *
 * Strategy B (fresh isolated league via the admin API, matching
 * adjustments.spec.ts / lifecycle.spec.ts) so this never races other specs'
 * standings rows.
 *
 * Prerequisites: `npm run seed:e2e`, global-setup admin auth state.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

test.use({ storageState: ADMIN_STORAGE_STATE });

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
// Alessandro Ferrari — an existing seeded driver. league_driver_entries
// uniqueness is scoped to (league_id, driver_id), so reusing a driver already
// active in the seeded Informal League is safe in a brand-new league.
const FERRARI_DRIVER_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const runId = Date.now();
const leagueName = `E2E Rollover League ${runId}`;
const leagueSlug = `e2e-rollover-${runId}`;
const season1Name = "Season 1";
const season2Name = "Season 2";
const session1Name = `E2E Rollover Race 1 ${runId}`;
const session2Name = `E2E Rollover Race 2 ${runId}`;

async function csrfHeaders(request: APIRequestContext) {
  const res = await request.get("/api/csrf");
  const { token } = (await res.json()) as { token: string };
  return { "x-csrf-token": token, origin: BASE_URL };
}

test.describe.serial("Season rollover — carry-over is the Season 2 action", () => {
  let leagueId = "";
  let teamId = "";
  let pointsSystemId = "";
  let circuitId = "";
  let season1Id = "";
  let season2Id = "";

  test("arrange: league + Season 1 + team + points system + driver + published race", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    const leagueRes = await request.post("/api/admin/leagues", {
      headers,
      data: { name: leagueName, slug: leagueSlug, format: "informal" },
    });
    expect(leagueRes.status()).toBe(201);
    leagueId = ((await leagueRes.json()) as { league: { id: string } }).league.id;

    const statusRes = await request.patch(`/api/admin/leagues/${leagueId}/status`, {
      headers,
      data: { status: "active" },
    });
    expect(statusRes.status()).toBe(200);

    // First season for a league is auto-marked current (seasons/route.ts POST).
    const season1Res = await request.post(`/api/admin/leagues/${leagueId}/seasons`, {
      headers,
      data: { name: season1Name, starts_on: "2024-01-01", ends_on: "2024-12-31" },
    });
    expect(season1Res.status()).toBe(201);
    const season1 = (await season1Res.json()) as { season: { id: string; is_current: boolean } };
    expect(season1.season.is_current).toBe(true);
    season1Id = season1.season.id;

    const teamRes = await request.post(`/api/admin/leagues/${leagueId}/teams`, {
      headers,
      data: {
        name: "E2E Rollover Team",
        slug: `e2e-rollover-team-${runId}`,
        kind: "custom",
        color_hex: "#663399",
      },
    });
    expect(teamRes.status()).toBe(201);
    teamId = ((await teamRes.json()) as { team: { id: string } }).team.id;

    const psRes = await request.post(`/api/admin/leagues/${leagueId}/points-systems`, {
      headers,
      data: {
        name: "E2E Rollover Points",
        points_by_position: { "1": 25 },
        fastest_lap_points: 0,
        pole_position_points: 0,
        max_positions: 1,
      },
    });
    expect(psRes.status()).toBe(201);
    pointsSystemId = ((await psRes.json()) as { points_system: { id: string } }).points_system.id;

    // Drivers are added to whatever season is currently current — Season 1 here.
    const driverRes = await request.post(`/api/admin/leagues/${leagueId}/drivers`, {
      headers,
      data: {
        driver_id: FERRARI_DRIVER_ID,
        team_id: teamId,
        is_reserve: false,
        joined_on: "2024-01-01",
      },
    });
    expect(driverRes.status()).toBe(201);

    // No admin circuits-list API exists — the session-new form is the only
    // place circuit IDs are exposed. Scrape the first real <option> value.
    await page.goto(`/admin/leagues/${leagueId}/sessions/new`);
    circuitId = (await page.locator("#circuit option").nth(1).getAttribute("value")) ?? "";
    expect(circuitId).toBeTruthy();

    // Sessions also resolve the league's current season server-side —
    // this one lands in Season 1.
    const session1Res = await request.post(`/api/admin/leagues/${leagueId}/sessions`, {
      headers,
      data: {
        circuit_id: circuitId,
        name: session1Name,
        points_system_id: pointsSystemId,
        race_length_percent: 100,
        race_number: 1,
        scheduled_at: new Date().toISOString(),
        session_code: "ROLLV1",
      },
    });
    expect(session1Res.status()).toBe(201);
    const session1Id = ((await session1Res.json()) as { session: { id: string } }).session.id;

    const publish1Res = await request.post(`/api/admin/sessions/${session1Id}/publish`, {
      headers,
      data: {
        league_id: leagueId,
        qualifying: [],
        results: [
          {
            driver_id: FERRARI_DRIVER_ID,
            team_id: teamId,
            finishing_position: 1,
            result_status: "classified",
            fastest_lap: false,
            manual_points_adjustment: 0,
            raw_result: null,
            notes: null,
          },
        ],
        penalties: [],
        republish: false,
      },
    });
    expect(publish1Res.status()).toBe(200);

    // Sanity: the public site currently defaults to Season 1 (its only/current season).
    await page.goto(`/leagues/${leagueSlug}/results`);
    await expect(page.getByText(session1Name)).toBeVisible();
  });

  test("carry-over creates Season 2 and makes it current", async ({ request }) => {
    const headers = await csrfHeaders(request);

    // A league's second season does NOT start current — only the explicit
    // set-current route or carry-over flips it.
    const season2Res = await request.post(`/api/admin/leagues/${leagueId}/seasons`, {
      headers,
      data: { name: season2Name, starts_on: "2025-01-01" },
    });
    expect(season2Res.status()).toBe(201);
    const season2 = (await season2Res.json()) as { season: { id: string; is_current: boolean } };
    expect(season2.season.is_current).toBe(false);
    season2Id = season2.season.id;

    const carryOverRes = await request.post(`/api/admin/leagues/${leagueId}/carry-over`, {
      headers,
      data: { from_season_id: season1Id, to_season_id: season2Id },
    });
    expect(carryOverRes.status()).toBe(201);
    const carryOver = (await carryOverRes.json()) as { carried_over: number };
    expect(carryOver.carried_over).toBeGreaterThanOrEqual(1);

    // This IS the "start Season 2" rollover action — assert it actually
    // flipped which season is current for the league.
    const seasonsRes = await request.get(`/api/admin/leagues/${leagueId}/seasons`);
    const { seasons } = (await seasonsRes.json()) as {
      seasons: { id: string; is_current: boolean }[];
    };
    expect(seasons.find((s) => s.id === season2Id)?.is_current).toBe(true);
    expect(seasons.find((s) => s.id === season1Id)?.is_current).toBe(false);
  });

  test("new race data after carry-over lands in Season 2; public site defaults to Season 2; Season 1 stays reachable via ?season=", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    // Session/driver creation now resolves Season 2 as the current season —
    // no season override is passed anywhere; this is the whole point of the
    // regression (the old model had no reliable way to guarantee this).
    const session2Res = await request.post(`/api/admin/leagues/${leagueId}/sessions`, {
      headers,
      data: {
        circuit_id: circuitId,
        name: session2Name,
        points_system_id: pointsSystemId,
        race_length_percent: 100,
        race_number: 1,
        scheduled_at: new Date().toISOString(),
        session_code: "ROLLV2",
      },
    });
    expect(session2Res.status()).toBe(201);
    const session2Id = ((await session2Res.json()) as { session: { id: string } }).session.id;

    const publish2Res = await request.post(`/api/admin/sessions/${session2Id}/publish`, {
      headers,
      data: {
        league_id: leagueId,
        qualifying: [],
        results: [
          {
            driver_id: FERRARI_DRIVER_ID,
            team_id: teamId,
            finishing_position: 1,
            result_status: "classified",
            fastest_lap: false,
            manual_points_adjustment: 0,
            raw_result: null,
            notes: null,
          },
        ],
        penalties: [],
        republish: false,
      },
    });
    expect(publish2Res.status()).toBe(200);

    // (b) Public site defaults to Season 2 (no ?season= param) — the season
    // selector reflects the league's new current season...
    await page.goto(`/leagues/${leagueSlug}/results`);
    await expect(page.locator("#season-selector")).toHaveValue(season2Id);
    // ...(a) and the new session shows up under that default view, while the
    // Season 1 session does not (it's a different season's completed race).
    await expect(page.getByText(session2Name)).toBeVisible();
    await expect(page.getByText(session1Name)).not.toBeVisible();

    // (c) Season 1 is still reachable via the ?season= selector, with its own
    // (unchanged) race data.
    await page.goto(`/leagues/${leagueSlug}/results?season=${season1Id}`);
    await expect(page.locator("#season-selector")).toHaveValue(season1Id);
    await expect(page.getByText(session1Name)).toBeVisible();
    await expect(page.getByText(session2Name)).not.toBeVisible();

    // Same story on standings — Season 2 is the default, Season 1 still has
    // its own standings snapshot reachable by id.
    await page.goto(`/leagues/${leagueSlug}/standings/drivers`);
    await expect(page.locator("#season-selector")).toHaveValue(season2Id);

    await page.goto(`/leagues/${leagueSlug}/standings/drivers?season=${season1Id}`);
    await expect(page.locator("#season-selector")).toHaveValue(season1Id);
  });
});
