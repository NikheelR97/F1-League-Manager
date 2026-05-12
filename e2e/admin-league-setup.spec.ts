/**
 * Admin E2E: league creation, team add, driver add.
 *
 * Prerequisites:
 *   - `npm run seed:e2e` has been run (creates e2e-admin@test.local)
 *   - global-setup has saved e2e/.auth/admin.json
 */

import { expect, test } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin league setup flow", () => {
  test("admin dashboard redirects to leagues list", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/leagues/);
    await expect(page.getByRole("heading", { name: "Leagues" })).toBeVisible();
  });

  test("admin can create a new league", async ({ page }) => {
    await page.goto("/admin/leagues/new");

    await expect(
      page.getByRole("heading", { name: "New League" }),
    ).toBeVisible();

    // Fill in the form
    await page.getByLabel("Name").fill("E2E Test League");
    await page.getByLabel("Slug").fill("e2e-test-league");

    // Submit
    await page.getByRole("button", { name: "Create League" }).click();

    // Should redirect to the new league detail page
    await expect(page).toHaveURL(/\/admin\/leagues\/[0-9a-f-]+/);
    await expect(
      page.getByRole("heading", { name: "E2E Test League" }),
    ).toBeVisible();
  });

  test("admin can add a team to a league", async ({ page }) => {
    // Navigate to the E2E test league created above; find via leagues list
    await page.goto("/admin/leagues");

    await page.getByRole("link", { name: "E2E Test League" }).click();
    await expect(page).toHaveURL(/\/admin\/leagues\/[0-9a-f-]+/);

    // Add a team
    await page.getByRole("link", { name: /Add Team/i }).click();

    await page.getByLabel("Name").fill("E2E Team Alpha");
    await page.getByRole("button", { name: /Create|Add|Save/i }).click();

    // Team should appear on the league detail page
    await expect(page.getByText("E2E Team Alpha")).toBeVisible();
  });

  test("admin can add a driver to a league", async ({ page }) => {
    await page.goto("/admin/leagues");
    await page.getByRole("link", { name: "E2E Test League" }).click();

    await page.getByRole("link", { name: /Add Driver/i }).click();

    await page.getByLabel("Name").fill("E2E Driver One");
    await page.getByRole("button", { name: /Add|Create|Save/i }).click();

    await expect(page.getByText("E2E Driver One")).toBeVisible();
  });

  test("seed leagues are visible in admin", async ({ page }) => {
    await page.goto("/admin/leagues");

    await expect(page.getByRole("link", { name: "Informal League" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Standard League" })).toBeVisible();
  });

  test("admin can navigate to session publish page", async ({ page }) => {
    // Use the seed Informal League (known ID from seed.sql)
    const INFORMAL_LEAGUE_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const AUSTRALIA_SESSION_ID = "09eebc99-9c0b-4ef8-bb6d-6bb9bd380a12";

    await page.goto(
      `/admin/leagues/${INFORMAL_LEAGUE_ID}/sessions/${AUSTRALIA_SESSION_ID}/publish`,
    );

    // Result entry page should load (Australia session is scheduled, not yet published)
    await expect(page.getByText(/Round 2.*Australia|Australia/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
