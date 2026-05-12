/**
 * Racer garage E2E: create, edit, delete setup; cross-racer isolation.
 *
 * Prerequisites:
 *   - `npm run seed:e2e` has been run (creates e2e-racer@test.local)
 *   - global-setup has saved e2e/.auth/racer.json and e2e/.auth/admin.json
 */

import { expect, test } from "@playwright/test";

import { ADMIN_STORAGE_STATE, RACER_STORAGE_STATE } from "../playwright.config";

test.describe("Racer garage — authenticated racer", () => {
  test.use({ storageState: RACER_STORAGE_STATE });

  test("racer can view the garage dashboard", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByRole("heading", { name: "My Setups" })).toBeVisible();
  });

  test("racer can create a setup", async ({ page }) => {
    await page.goto("/garage/new");
    await expect(page.getByRole("heading", { name: "New Setup" })).toBeVisible();

    await page.getByLabel("Setup Name").fill("E2E Qualifying Setup");
    await page.getByRole("button", { name: "Create Setup" }).click();

    // Should navigate back to garage or setup detail page
    await expect(page).not.toHaveURL(/\/garage\/new/);
    await expect(page.getByText("E2E Qualifying Setup")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("racer can edit their setup", async ({ page }) => {
    await page.goto("/garage");

    // Find and open the created setup
    await page.getByRole("link", { name: "E2E Qualifying Setup" }).click();
    await page.getByRole("link", { name: /Edit/i }).click();

    await expect(
      page.getByRole("heading", { name: "Edit Setup" }),
    ).toBeVisible();

    // Rename the setup
    const nameField = page.getByLabel("Setup Name");
    await nameField.fill("E2E Race Setup (Renamed)");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("E2E Race Setup (Renamed)")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("racer can delete their setup", async ({ page }) => {
    await page.goto("/garage");
    await page.getByRole("link", { name: "E2E Race Setup (Renamed)" }).click();

    // Find and click delete
    await page.getByRole("button", { name: /Delete/i }).click();

    // Confirm deletion if a confirmation dialog appears
    const confirmButton = page.getByRole("button", { name: /Confirm|Yes|Delete/i });
    if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Should be back at the garage list
    await expect(page).toHaveURL(/\/garage/);
    await expect(
      page.getByText("E2E Race Setup (Renamed)"),
    ).not.toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Racer garage — cross-racer isolation", () => {
  test("racer API returns 404 for setup owned by another user", async ({ browser }) => {
    // Step 1: Racer creates a setup and captures the ID
    const racerContext = await browser.newContext({
      storageState: RACER_STORAGE_STATE,
    });
    const racerPage = await racerContext.newPage();
    await racerPage.goto("/garage");

    // Create a fresh private setup
    await racerPage.goto("/garage/new");
    await racerPage.getByLabel("Setup Name").fill("E2E Private Setup");
    await racerPage.getByRole("button", { name: "Create Setup" }).click();
    await racerPage.waitForURL(/\/garage\/[0-9a-f-]+/);
    const setupUrl = racerPage.url();
    const setupId = setupUrl.match(/\/garage\/([0-9a-f-]+)/)?.[1];
    expect(setupId).toBeTruthy();

    await racerContext.close();

    // Step 2: Admin (different user, no driver ownership) requests the racer's setup API
    const adminContext = await browser.newContext({
      storageState: ADMIN_STORAGE_STATE,
    });
    const adminPage = await adminContext.newPage();

    const response = await adminPage.request.get(`/api/racer/setups/${setupId}`);
    // Server must return 404 — not 403 — to avoid leaking existence
    expect(response.status()).toBe(404);

    await adminContext.close();
  });
});

test.describe("Racer garage — unauthenticated", () => {
  test("unauthenticated user cannot access the garage", async ({ browser }) => {
    const context = await browser.newContext(); // no auth state
    const page = await context.newPage();

    await page.goto("/garage");

    // Should be redirected away from /garage
    await expect(page).not.toHaveURL(/\/garage/);

    await context.close();
  });
});
