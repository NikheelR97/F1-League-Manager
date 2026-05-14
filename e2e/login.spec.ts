import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const ADMIN_EMAIL = "e2e-admin@test.local";
const RACER_EMAIL = "e2e-racer@test.local";
const TEST_PASSWORD = "E2eTestPassword!1";

test.describe("Login", () => {
  test("admin login preserves the protected destination", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL((url) => {
      return url.pathname === "/login" && url.searchParams.get("next") === "/admin";
    });

    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin\/leagues/);
    await expect(page.getByRole("heading", { name: "Leagues" })).toBeVisible();
  });

  test("racer login preserves the protected destination", async ({ page }) => {
    await page.goto("/garage");

    await expect(page).toHaveURL((url) => {
      return url.pathname === "/login" && url.searchParams.get("next") === "/garage";
    });

    await page.getByLabel("Email").fill(RACER_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/garage/);
    await expect(page.getByRole("heading", { name: "My Setups" })).toBeVisible();
  });

  test("invalid credentials stay on login with a safe error", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("not-a-user@test.local");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await expect(page.getByText("Email or password is incorrect.")).toHaveText(
      "Email or password is incorrect.",
    );
  });
});
