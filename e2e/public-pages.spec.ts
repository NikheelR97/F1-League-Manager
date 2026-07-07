/**
 * Public read-surface E2E — audit4 findings E6 (Tier 5: 404s, empty states, mobile).
 *
 * T16 and T20 are self-contained (seeded Informal League, read-only). T17
 * creates its own minimal fresh league (Strategy B) with no team/driver/session
 * so every page under it renders through its empty-state path.
 *
 * Prerequisites: `npm run seed:e2e`, global-setup admin auth state.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

test.use({ storageState: ADMIN_STORAGE_STATE });

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SEASON_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // 2025 Season (seed.sql)
const MOBILE_VIEWPORT = { height: 800, width: 375 };

async function csrfHeaders(request: APIRequestContext) {
  const res = await request.get("/api/csrf");
  const { token } = (await res.json()) as { token: string };
  return { "x-csrf-token": token, origin: BASE_URL };
}

test("T16: unknown league slug returns 404 with not-found UI", async ({ page }) => {
  const res = await page.goto("/leagues/nope-does-not-exist-123");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("T17: freshly created league with no sessions shows empty states, not crashes", async ({
  page,
  request,
}) => {
  const runId = Date.now();
  const headers = await csrfHeaders(request);

  const leagueRes = await request.post("/api/admin/leagues", {
    headers,
    data: {
      name: `E2E Empty League ${runId}`,
      slug: `e2e-empty-league-${runId}`,
      format: "informal",
      season_id: SEASON_ID,
    },
  });
  expect(leagueRes.status()).toBe(201);
  const league = ((await leagueRes.json()) as { league: { id: string; slug: string } }).league;

  const activateRes = await request.patch(`/api/admin/leagues/${league.id}/status`, {
    headers,
    data: { status: "active" },
  });
  expect(activateRes.status()).toBe(200);

  const slug = league.slug;

  await page.goto(`/leagues/${slug}/calendar`);
  await expect(page.getByText("No upcoming races scheduled.")).toBeVisible();

  await page.goto(`/leagues/${slug}/standings/drivers`);
  await expect(page.getByRole("heading", { name: "No standings yet" })).toBeVisible();

  await page.goto(`/leagues/${slug}/results`);
  await expect(page.getByRole("heading", { name: "No results yet" })).toBeVisible();
});

test("T20: mobile Informal League calendar has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/leagues/informal/calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
