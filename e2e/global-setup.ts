/**
 * Playwright global setup — authenticates test users and saves storage state.
 *
 * Prerequisite: run `npm run seed:e2e` against the local Supabase instance
 * before running E2E tests for the first time (or after `supabase db reset`).
 *
 * Output files (gitignored):
 *   e2e/.auth/admin.json  — admin session cookies
 *   e2e/.auth/racer.json  — racer session cookies
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { chromium, type BrowserContext } from "@playwright/test";

// Load .env.local so E2E_SECRET is available when Playwright runs the setup
// (Next.js loads .env.local automatically, but Playwright's test runner does not)
const envLocalPath = path.resolve(".env.local");
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] ??= match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const E2E_SECRET = process.env.E2E_SECRET;
const ADMIN_EMAIL = "e2e-admin@test.local";
const RACER_EMAIL = "e2e-racer@test.local";
const TEST_PASSWORD = "E2eTestPassword!1";
// Resolved from project root (process.cwd() during `npm run test:e2e`)
const AUTH_DIR = path.resolve("e2e/.auth");

if (!E2E_SECRET) {
  throw new Error(
    "E2E_SECRET env var is required. Add it to .env.local:\n  E2E_SECRET=dev-e2e-secret-32-chars-min",
  );
}

async function authenticate(
  context: BrowserContext,
  email: string,
  password: string,
): Promise<void> {
  const page = await context.newPage();

  const response = await page.request.post(`${BASE_URL}/api/e2e/session`, {
    headers: { "x-e2e-secret": E2E_SECRET! },
    data: { email, password },
  });

  if (!response.ok()) {
    const body = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Session setup failed for ${email}: HTTP ${response.status()} — ${body}`,
    );
  }

  await page.close();
}

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();

  // Admin session
  const adminContext = await browser.newContext({
    baseURL: BASE_URL,
  });
  await authenticate(adminContext, ADMIN_EMAIL, TEST_PASSWORD);
  await adminContext.storageState({ path: path.join(AUTH_DIR, "admin.json") });
  await adminContext.close();
  console.log("  [e2e] saved admin auth state");

  // Racer session
  const racerContext = await browser.newContext({
    baseURL: BASE_URL,
  });
  await authenticate(racerContext, RACER_EMAIL, TEST_PASSWORD);
  await racerContext.storageState({ path: path.join(AUTH_DIR, "racer.json") });
  await racerContext.close();
  console.log("  [e2e] saved racer auth state");

  await browser.close();
}
