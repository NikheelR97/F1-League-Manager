import { expect, test } from "@playwright/test";

const S2_MOBILE_VIEWPORT = { height: 800, width: 375 };
const S2_DESKTOP_SCREENSHOT = "test-results/s2-home-desktop.png";
const S2_MOBILE_SCREENSHOT = "test-results/s2-home-mobile.png";

test("home page renders the public league directory", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "F1 Esports League Manager" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Informal League" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Standard League" }),
  ).toBeVisible();
  await page.screenshot({ fullPage: true, path: S2_DESKTOP_SCREENSHOT });
});

test("mobile home page has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize(S2_MOBILE_VIEWPORT);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "F1 Esports League Manager" }),
  ).toBeVisible();
  await page.screenshot({ fullPage: true, path: S2_MOBILE_SCREENSHOT });

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });

  expect(hasHorizontalOverflow).toBe(false);
});
