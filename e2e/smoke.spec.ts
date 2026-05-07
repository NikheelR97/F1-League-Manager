import { expect, test } from "@playwright/test";

test("home page renders the S0 project foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "F1 Esports League Manager" }),
  ).toBeVisible();
  await expect(page.getByText("Sprint 0")).toBeVisible();
});
