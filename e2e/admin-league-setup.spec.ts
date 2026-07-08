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

const runId = Date.now();
const leagueName = `E2E Test League ${runId}`;
const leagueSlug = `e2e-test-league-${runId}`;
const teamName = `E2E Team Alpha ${runId}`;
let createdLeagueUrl = "";

test.describe.serial("Admin league setup flow", () => {
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
    await page.getByLabel("Season").selectOption({ label: "2025 Season" });
    await page.getByLabel("Name").fill(leagueName);
    await page.getByLabel("Slug").fill(leagueSlug);

    // Submit
    await page.getByRole("button", { name: "Create League" }).click();

    // Should redirect to the new league detail page
    await expect(page).toHaveURL(/\/admin\/leagues\/[0-9a-f-]+/);
    createdLeagueUrl = page.url();
    await expect(page.getByRole("heading", { name: leagueName })).toBeVisible();
  });

  test("admin can add a team to a league", async ({ page }) => {
    await page.goto(createdLeagueUrl);

    // Add a team
    await page.getByRole("link", { name: /Add Team/i }).click();

    await page.getByLabel("Name").fill(teamName);
    await page.getByRole("button", { name: "Create Team" }).click();

    // Team should appear on the league detail page
    await expect(page.getByText(teamName)).toBeVisible();
  });

  test("admin can add a driver to a league", async ({ page }) => {
    await page.goto(createdLeagueUrl);

    await page.getByRole("link", { name: /Add Driver/i }).click();

    await page
      .getByLabel("Driver", { exact: true })
      .selectOption({ label: "E2E Racer (#98)" });
    await page.getByLabel("Team").selectOption({ label: teamName });
    await page.getByRole("button", { name: "Add to League" }).click();

    await expect(page.getByText("E2E Racer")).toBeVisible();
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
