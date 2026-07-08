/**
 * Role-security / auth-boundary E2E — audit4 findings E1/E2/E3.
 *
 * Each test is self-contained (before/after comparisons instead of asserting
 * an absolute seeded number), so these are safe to run in any order relative
 * to other spec files that also touch the Informal League.
 *
 * Prerequisites: `npm run seed:e2e`, global-setup admin+racer auth states.
 */

import { expect, test } from "@playwright/test";

import { ADMIN_STORAGE_STATE, RACER_STORAGE_STATE } from "../playwright.config";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const INFORMAL_LEAGUE_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SEASON_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const FERRARI_DRIVER_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

test.describe("T7: RACER cannot reach admin pages", () => {
  test.use({ storageState: RACER_STORAGE_STATE });

  test("racer is redirected away from /admin/leagues", async ({ page }) => {
    await page.goto("/admin/leagues");
    // src/app/admin/layout.tsx redirects a non-admin authenticated user to "/".
    await expect(page).not.toHaveURL(/\/admin\/leagues/);
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.getByRole("heading", { name: "Leagues" })).not.toBeVisible();
  });
});

test.describe("T8: RACER blocked from admin APIs", () => {
  test.use({ storageState: RACER_STORAGE_STATE });

  test("racer POST to admin adjustments API is forbidden and creates no row", async ({ page, request }) => {
    await page.goto("/leagues/informal/standings/drivers");
    const ferrariRow = page.locator('table tbody tr[data-driver-name="alessandro ferrari"]');
    const before = await ferrariRow.locator("td").nth(4).textContent();

    const res = await request.post(`/api/admin/leagues/${INFORMAL_LEAGUE_ID}/adjustments`, {
      // withAdminGuard checks the Origin header before the session/role
      // check, so it must be present or a role-mismatch 403 would instead be
      // masked by an origin-mismatch 403.
      headers: { origin: BASE_URL },
      data: {
        adjustment_kind: "bonus",
        driver_id: FERRARI_DRIVER_ID,
        points_delta: 5,
        reason: "e2e T8 forbidden probe",
        season_id: SEASON_ID,
      },
    });
    expect(res.status()).toBe(403);

    await page.goto("/leagues/informal/standings/drivers");
    const after = await ferrariRow.locator("td").nth(4).textContent();
    expect(after).toBe(before);
  });
});

test.describe("T9: unauthenticated admin API access", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated POST to admin leagues API returns 401", async ({ request }) => {
    const res = await request.post("/api/admin/leagues", {
      headers: { origin: BASE_URL },
      data: {
        name: "Should Never Be Created",
        slug: `e2e-unauth-probe-${Date.now()}`,
        format: "informal",
        season_id: SEASON_ID,
      },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("T10: cross-owner racer API isolation", () => {
  test("non-owner admin DELETE on a racer's setup is rejected and the setup survives", async ({ browser }) => {
    const setupName = `E2E Cross-Owner Setup ${Date.now()}`;

    const racerContext = await browser.newContext({ storageState: RACER_STORAGE_STATE });
    const racerPage = await racerContext.newPage();
    await racerPage.goto("/garage/new");
    await racerPage.getByLabel("Driver").selectOption({ label: "E2E Racer" });
    await racerPage.getByLabel("Setup Name").fill(setupName);
    await racerPage.getByLabel("Circuit").selectOption({ index: 1 });
    await racerPage.getByRole("button", { name: "Create Setup" }).click();
    await expect(racerPage).toHaveURL(/\/garage/);
    await expect(racerPage.getByText(setupName)).toBeVisible({ timeout: 10_000 });

    const editHref = await racerPage
      .getByRole("link", { name: "Edit setup" })
      .first()
      .getAttribute("href");
    const setupId = editHref?.match(/\/garage\/([0-9a-f-]+)\/edit/)?.[1];
    expect(setupId).toBeTruthy();
    await racerContext.close();

    const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
    const csrfRes = await adminContext.request.get("/api/csrf");
    const { token } = (await csrfRes.json()) as { token: string };
    // resolveOwnedSetup (src/app/api/racer/setups/[id]/route.ts) returns null
    // when the setup's driver isn't linked to the caller's profile, which
    // the route maps to 404 — any authenticated user (including an admin)
    // passes withRacerGuard's session check, so ownership is what's tested.
    const delRes = await adminContext.request.delete(`/api/racer/setups/${setupId}`, {
      headers: { "x-csrf-token": token, origin: BASE_URL },
    });
    expect([403, 404]).toContain(delRes.status());
    await adminContext.close();

    const verifyContext = await browser.newContext({ storageState: RACER_STORAGE_STATE });
    const verifyPage = await verifyContext.newPage();
    await verifyPage.goto("/garage");
    await expect(verifyPage.getByText(setupName)).toBeVisible();
    await verifyContext.close();
  });
});
