/**
 * Direct standings mutation E2E — audit4 findings E4 (Tier 2: adjustments).
 *
 * Strategy B (dev docs/audit4 e2e-test-design.md): a fresh, isolated league
 * created via the admin API (not the shared seeded Informal League), so this
 * spec never races results-publish.spec.ts for the same standings rows.
 *
 * A freshly POSTed league starts life in 'draft' status (schema default,
 * supabase/migrations/20260507161000_s1_core_schema.sql L40) — resolvePublicLeague
 * excludes drafts (`.neq("status","draft")`), so the league is PATCHed to
 * 'active' before any public-page assertion.
 *
 * Prerequisites: `npm run seed:e2e`, global-setup admin auth state.
 */

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

test.use({ storageState: ADMIN_STORAGE_STATE });

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SEASON_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // 2025 Season (seed.sql)
// Alessandro Ferrari — an existing seeded driver. league_driver_entries
// uniqueness is scoped to (league_id, driver_id), so reusing a driver already
// active in the seeded Informal League is safe in a brand-new league.
const FERRARI_DRIVER_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const runId = Date.now();
const leagueName = `E2E Adjustments League ${runId}`;
const leagueSlug = `e2e-adjustments-${runId}`;

async function csrfHeaders(request: APIRequestContext) {
  const res = await request.get("/api/csrf");
  const { token } = (await res.json()) as { token: string };
  return { "x-csrf-token": token, origin: BASE_URL };
}

function pointsCell(page: Page) {
  return page.locator("table tbody tr").first().locator("td").nth(4);
}

test.describe.serial("Adjustments — fresh isolated league (T4, T5)", () => {
  let leagueId = "";

  test("arrange: league + team + points system + driver + published baseline (25 pts)", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    const leagueRes = await request.post("/api/admin/leagues", {
      headers,
      data: {
        name: leagueName,
        slug: leagueSlug,
        format: "informal",
        season_id: SEASON_ID,
        fastest_lap_enabled: false,
        pole_position_enabled: false,
        constructor_championship_enabled: false,
        penalty_threshold: 12,
      },
    });
    expect(leagueRes.status()).toBe(201);
    leagueId = ((await leagueRes.json()) as { league: { id: string } }).league.id;

    // Draft leagues 404 on every public page — activate before any public assertion.
    const statusRes = await request.patch(`/api/admin/leagues/${leagueId}/status`, {
      headers,
      data: { status: "active" },
    });
    expect(statusRes.status()).toBe(200);

    const teamRes = await request.post(`/api/admin/leagues/${leagueId}/teams`, {
      headers,
      data: {
        name: "E2E Solo Team",
        slug: `e2e-solo-team-${runId}`,
        kind: "custom",
        color_hex: "#336699",
      },
    });
    expect(teamRes.status()).toBe(201);
    const teamId = ((await teamRes.json()) as { team: { id: string } }).team.id;

    const psRes = await request.post(`/api/admin/leagues/${leagueId}/points-systems`, {
      headers,
      data: {
        name: "E2E Single Position",
        points_by_position: { "1": 25 },
        fastest_lap_points: 0,
        pole_position_points: 0,
        max_positions: 1,
      },
    });
    expect(psRes.status()).toBe(201);
    const pointsSystemId = ((await psRes.json()) as { points_system: { id: string } })
      .points_system.id;

    const driverRes = await request.post(`/api/admin/leagues/${leagueId}/drivers`, {
      headers,
      data: {
        driver_id: FERRARI_DRIVER_ID,
        team_id: teamId,
        is_reserve: false,
        joined_on: "2025-01-01",
      },
    });
    expect(driverRes.status()).toBe(201);

    // No admin circuits-list API exists — the session-new form is the only
    // place circuit IDs are exposed (design doc §1 T11). Scrape the first
    // real <option> value instead of driving the whole form.
    await page.goto(`/admin/leagues/${leagueId}/sessions/new`);
    const circuitId = await page.locator("#circuit option").nth(1).getAttribute("value");
    expect(circuitId).toBeTruthy();

    const sessionRes = await request.post(`/api/admin/leagues/${leagueId}/sessions`, {
      headers,
      data: {
        circuit_id: circuitId,
        name: "E2E Solo Race",
        points_system_id: pointsSystemId,
        race_length_percent: 100,
        race_number: 1,
        scheduled_at: new Date().toISOString(),
        session_code: "ADJ001",
      },
    });
    expect(sessionRes.status()).toBe(201);
    const sessionId = ((await sessionRes.json()) as { session: { id: string } }).session.id;

    const publishRes = await request.post(`/api/admin/sessions/${sessionId}/publish`, {
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
    expect(publishRes.status()).toBe(200);

    // First-ever read for this league's standings cache key — guaranteed
    // fresh (nothing to be stale yet), unlike later reads after a mutation.
    await page.goto(`/leagues/${leagueSlug}/standings/drivers`);
    await expect(pointsCell(page)).toHaveText("25");
  });

  test("T4: +5 adjustment raises public standings to 30, delete reverts to 25", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    const adjRes = await request.post(`/api/admin/leagues/${leagueId}/adjustments`, {
      headers,
      data: {
        adjustment_kind: "bonus",
        driver_id: FERRARI_DRIVER_ID,
        points_delta: 5,
        reason: "e2e T4 bonus",
        season_id: SEASON_ID,
      },
    });
    expect(adjRes.status()).toBe(201);
    const adjustmentId = ((await adjRes.json()) as { id: string }).id;

    // Standings page is unstable_cache'd; revalidateTag is stale-while-revalidate
    // (same eventual-consistency window results-publish.spec.ts documents), so poll.
    await expect
      .poll(async () => {
        await page.goto(`/leagues/${leagueSlug}/standings/drivers`);
        return pointsCell(page).textContent();
      })
      .toBe("30");

    const delRes = await request.delete(`/api/admin/adjustments/${adjustmentId}`, { headers });
    expect(delRes.status()).toBe(200);

    await expect
      .poll(async () => {
        await page.goto(`/leagues/${leagueSlug}/standings/drivers`);
        return pointsCell(page).textContent();
      })
      .toBe("25");
  });

  test("T5: out-of-range / non-numeric adjustment delta rejected, standings unchanged", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);
    const base = {
      adjustment_kind: "bonus" as const,
      driver_id: FERRARI_DRIVER_ID,
      reason: "e2e T5 rejected",
      season_id: SEASON_ID,
    };

    const wayOver = await request.post(`/api/admin/leagues/${leagueId}/adjustments`, {
      headers,
      data: { ...base, points_delta: 1_000_000_000 },
    });
    expect(wayOver.status()).toBe(422);

    const overCap = await request.post(`/api/admin/leagues/${leagueId}/adjustments`, {
      headers,
      data: { ...base, points_delta: 250 }, // schema caps at ±200
    });
    expect(overCap.status()).toBe(422);

    const nonNumeric = await request.post(`/api/admin/leagues/${leagueId}/adjustments`, {
      headers,
      data: { ...base, points_delta: "abc" },
    });
    expect(nonNumeric.status()).toBe(422);

    // No revalidateTag fires on a 422 — the cache from T4's final read (25)
    // is still current, so a plain read (no poll) is sufficient here.
    await page.goto(`/leagues/${leagueSlug}/standings/drivers`);
    await expect(pointsCell(page)).toHaveText("25");
  });
});
