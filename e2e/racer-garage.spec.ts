/**
 * Racer garage E2E: create, edit, delete setup; cross-racer isolation.
 *
 * Prerequisites:
 *   - `npm run seed:e2e` has been run (creates e2e-racer@test.local)
 *   - global-setup has saved e2e/.auth/racer.json and e2e/.auth/admin.json
 */

import { expect, test } from "@playwright/test";

import { ADMIN_STORAGE_STATE, RACER_STORAGE_STATE } from "../playwright.config";

const runId = Date.now();
const setupName = `E2E Qualifying Setup ${runId}`;
const renamedSetupName = `E2E Race Setup ${runId} Renamed`;
const privateSetupName = `E2E Private Setup ${runId}`;

test.describe.serial("Racer garage - authenticated racer", () => {
  test.use({ storageState: RACER_STORAGE_STATE });

  test("racer can view the garage dashboard", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByRole("heading", { name: "My Setups" })).toBeVisible();
  });

  test("racer can create a setup", async ({ page }) => {
    await page.goto("/garage/new");
    await expect(page.getByRole("heading", { name: "New Setup" })).toBeVisible();

    await page.getByLabel("Driver").selectOption({ label: "E2E Racer" });
    await page.getByLabel("Setup Name").fill(setupName);
    await page.getByLabel("Circuit").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Create Setup" }).click();

    await expect(page).toHaveURL(/\/garage/);
    await expect(page.getByText(setupName)).toBeVisible({ timeout: 10_000 });
  });

  test("racer can edit their setup", async ({ page }) => {
    await page.goto("/garage");

    await expect(page.getByText(setupName)).toBeVisible();
    await page.getByRole("link", { name: "Edit setup" }).first().click();

    await expect(
      page.getByRole("heading", { name: "Edit Setup" }),
    ).toBeVisible();

    await page.getByLabel("Setup Name").fill(renamedSetupName);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText(renamedSetupName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("racer can delete their setup", async ({ page }) => {
    await page.goto("/garage");
    await expect(page.getByText(renamedSetupName)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete setup" }).first().click();

    await expect(page).toHaveURL(/\/garage/);
    await expect(page.getByText(renamedSetupName)).not.toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Racer garage - cross-racer isolation", () => {
  test("setup edit page returns 404 for setup owned by another user", async ({ browser }) => {
    const racerContext = await browser.newContext({
      storageState: RACER_STORAGE_STATE,
    });
    const racerPage = await racerContext.newPage();

    await racerPage.goto("/garage/new");
    await racerPage.getByLabel("Driver").selectOption({ label: "E2E Racer" });
    await racerPage.getByLabel("Setup Name").fill(privateSetupName);
    await racerPage.getByLabel("Circuit").selectOption({ index: 1 });
    await racerPage.getByRole("button", { name: "Create Setup" }).click();
    await expect(racerPage).toHaveURL(/\/garage/);
    await expect(racerPage.getByText(privateSetupName)).toBeVisible();

    const editHref = await racerPage
      .getByRole("link", { name: "Edit setup" })
      .first()
      .getAttribute("href");
    const setupId = editHref?.match(/\/garage\/([0-9a-f-]+)\/edit/)?.[1];
    expect(setupId).toBeTruthy();

    await racerContext.close();

    const adminContext = await browser.newContext({
      storageState: ADMIN_STORAGE_STATE,
    });
    const adminPage = await adminContext.newPage();

    const response = await adminPage.goto(`/garage/${setupId}/edit`);
    expect(response?.status()).toBe(404);

    await adminContext.close();
  });
});

test.describe("Racer garage - unauthenticated", () => {
  test("unauthenticated user cannot access the garage", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    await page.goto("/garage");

    await expect(page).not.toHaveURL(/\/garage/);

    await context.close();
  });
});
