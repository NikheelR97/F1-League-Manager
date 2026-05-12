/**
 * Admin E2E: digital wheel spin and confirmation.
 *
 * Prerequisites:
 *   - `npm run seed:e2e` has been run
 *   - global-setup has saved e2e/.auth/admin.json
 *   - Informal League has a circuit pool (set up via admin UI or seed)
 */

import { expect, test } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

// Informal League ID from seed.sql
const INFORMAL_LEAGUE_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Digital wheel flow", () => {
  test("admin can navigate to the wheel page", async ({ page }) => {
    await page.goto(`/admin/leagues/${INFORMAL_LEAGUE_ID}/wheel`);

    // Wheel page should load
    await expect(
      page.getByRole("heading", { name: /Wheel|Circuit|Spin/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("wheel page is protected — unauthenticated user is redirected", async ({
    browser,
  }) => {
    // Fresh context with no auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/admin/leagues/${INFORMAL_LEAGUE_ID}/wheel`);

    // Should be redirected away from admin (login or root)
    await expect(page).not.toHaveURL(/\/admin\/leagues/);

    await context.close();
  });
});
