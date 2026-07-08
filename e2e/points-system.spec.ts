/**
 * Admin E2E: points system creation.
 *
 * Regression test for a silent dead-submit bug on the "New Points System"
 * form (points_by_position was required by the RHF zod schema but never
 * registered with the form, so validation always failed silently).
 *
 * Prerequisites:
 *   - `npm run seed:e2e` has been run (creates e2e-admin@test.local)
 *   - global-setup has saved e2e/.auth/admin.json
 */

import { expect, test } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

test.use({ storageState: ADMIN_STORAGE_STATE });

const runId = Date.now();
const leagueName = `E2E Points League ${runId}`;
const leagueSlug = `e2e-points-league-${runId}`;
const pointsSystemName = `E2E Points System ${runId}`;

test("admin can create a points system for a league", async ({ page }) => {
  // Create a fresh league to attach the points system to.
  await page.goto("/admin/leagues/new");
  await page.getByLabel("Season").selectOption({ label: "2025 Season" });
  await page.getByLabel("Name").fill(leagueName);
  await page.getByLabel("Slug").fill(leagueSlug);
  await page.getByRole("button", { name: "Create League" }).click();

  await expect(page).toHaveURL(/\/admin\/leagues\/[0-9a-f-]+/);
  const leagueUrl = page.url();

  // Navigate to the New Points System page.
  await page.getByRole("link", { name: "Add Points System" }).click();
  await expect(page).toHaveURL(/\/points-systems\/new$/);

  // Fill the name; leave the pre-populated defaults (standard F1 points) as-is.
  await page.getByLabel("Name").fill(pointsSystemName);
  await page.getByRole("button", { name: "Create Points System" }).click();

  // Previously this submit was completely dead (no navigation, no request).
  // It should now redirect back to the league detail page.
  await expect(page).toHaveURL(leagueUrl);
  await expect(page.getByText(pointsSystemName)).toBeVisible();
});
