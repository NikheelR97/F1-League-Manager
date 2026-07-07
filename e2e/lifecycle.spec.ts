/**
 * Lifecycle mutation E2E — audit4 findings E5 (Tier 4: sessions, transfers, archive).
 *
 * Strategy B: one fresh, isolated league (created via admin API), shared across
 * T11-T15 in a single `describe.serial` block to amortize arrangement cost.
 * A freshly POSTed league starts 'draft' (schema default) — PATCHed to 'active'
 * immediately since resolvePublicLeague/homepage both exclude drafts.
 *
 * Test order deviates from the design doc's T-numbering for correctness: T13
 * (archive) is run LAST because active->archived is a one-way transition
 * (status/route.ts ALLOWED_TRANSITIONS has no archived->active), so archiving
 * earlier would strand every later test that depends on writing to this league.
 *
 * Prerequisites: `npm run seed:e2e`, global-setup admin auth state.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "../playwright.config";

test.use({ storageState: ADMIN_STORAGE_STATE });

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SEASON_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // 2025 Season (seed.sql)
const FERRARI_DRIVER_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // Alessandro Ferrari
// Seeded completed Informal League session (Bahrain) — used read-only to probe
// the "cannot delete a completed session" 400 without publishing our own.
const BAHRAIN_SESSION_ID = "09eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const runId = Date.now();
const leagueName = `E2E Lifecycle League ${runId}`;
const leagueSlug = `e2e-lifecycle-${runId}`;
const sessionName = `E2E Lifecycle Race ${runId}`;

async function csrfHeaders(request: APIRequestContext) {
  const res = await request.get("/api/csrf");
  const { token } = (await res.json()) as { token: string };
  return { "x-csrf-token": token, origin: BASE_URL };
}

function futureDatetimeLocal(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

test.describe.serial("Lifecycle — fresh isolated league (T11, T12, T14, T15, T13)", () => {
  let leagueId = "";
  let teamAId = "";
  let teamBId = "";
  let driverEntryId = "";
  let createdSessionId = "";

  test("arrange: league (active) + 2 teams + points system + driver on team A", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    const leagueRes = await request.post("/api/admin/leagues", {
      headers,
      data: {
        name: leagueName,
        slug: leagueSlug,
        format: "informal",
        season_id: SEASON_ID,
      },
    });
    expect(leagueRes.status()).toBe(201);
    leagueId = ((await leagueRes.json()) as { league: { id: string } }).league.id;

    const statusRes = await request.patch(`/api/admin/leagues/${leagueId}/status`, {
      headers,
      data: { status: "active" },
    });
    expect(statusRes.status()).toBe(200);

    const teamARes = await request.post(`/api/admin/leagues/${leagueId}/teams`, {
      headers,
      data: { name: "E2E Team Alpha", slug: `e2e-lc-alpha-${runId}`, kind: "custom", color_hex: "#112233" },
    });
    expect(teamARes.status()).toBe(201);
    teamAId = ((await teamARes.json()) as { team: { id: string } }).team.id;

    const teamBRes = await request.post(`/api/admin/leagues/${leagueId}/teams`, {
      headers,
      data: { name: "E2E Team Bravo", slug: `e2e-lc-bravo-${runId}`, kind: "custom", color_hex: "#445566" },
    });
    expect(teamBRes.status()).toBe(201);
    teamBId = ((await teamBRes.json()) as { team: { id: string } }).team.id;

    const psRes = await request.post(`/api/admin/leagues/${leagueId}/points-systems`, {
      headers,
      data: {
        name: "E2E Lifecycle Points",
        points_by_position: { "1": 25 },
        fastest_lap_points: 0,
        pole_position_points: 0,
        max_positions: 1,
      },
    });
    expect(psRes.status()).toBe(201);

    const driverRes = await request.post(`/api/admin/leagues/${leagueId}/drivers`, {
      headers,
      data: {
        driver_id: FERRARI_DRIVER_ID,
        team_id: teamAId,
        is_reserve: false,
        joined_on: "2025-01-01",
      },
    });
    expect(driverRes.status()).toBe(201);
    driverEntryId = ((await driverRes.json()) as { entry_id: string }).entry_id;

    // Sanity: league is visible (not draft) before we start mutating it.
    await page.goto("/");
    await expect(page.getByText(leagueName)).toBeVisible();
  });

  test("T11: session create via admin UI form appears on public calendar", async ({
    page,
    request,
  }) => {
    await page.goto(`/admin/leagues/${leagueId}/sessions/new`);
    await page.getByLabel("Circuit").selectOption({ index: 1 });
    await page.getByLabel("Session name").fill(sessionName);
    await page.getByLabel("Scheduled date & time").fill(futureDatetimeLocal());
    await page.getByRole("button", { name: "Create Session" }).click();

    await expect(page).toHaveURL(`${BASE_URL}/admin/leagues/${leagueId}`);

    const sessionsRes = await request.get(`/api/admin/leagues/${leagueId}/sessions`);
    const { sessions } = (await sessionsRes.json()) as { sessions: { id: string; name: string }[] };
    const created = sessions.find((s) => s.name === sessionName);
    expect(created).toBeTruthy();
    createdSessionId = created!.id;

    await page.goto(`/leagues/${leagueSlug}/calendar`);
    await expect(page.getByText(sessionName)).toBeVisible();
  });

  test("T12: session delete removes it from the public calendar; completed session delete is rejected", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    const delRes = await request.delete(`/api/admin/sessions/${createdSessionId}`, { headers });
    expect(delRes.status()).toBe(204);

    await page.goto(`/leagues/${leagueSlug}/calendar`);
    await expect(page.getByText(sessionName)).not.toBeVisible();

    // Deleting a completed session is blocked by design (route L118) — probe
    // against the seeded Bahrain session (read-only: the route 400s before
    // touching the DB, so this never mutates seed data).
    const completedDelRes = await request.delete(`/api/admin/sessions/${BAHRAIN_SESSION_ID}`, {
      headers,
    });
    expect(completedDelRes.status()).toBe(400);
  });

  test("T14: transfer moves the driver to team B on the public team page", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    const transferRes = await request.post(`/api/admin/leagues/${leagueId}/transfers`, {
      headers,
      data: {
        driver_entry_id: driverEntryId,
        effective_date: "2025-06-01",
        new_team_id: teamBId,
      },
    });
    expect(transferRes.status()).toBe(200);

    // No dedicated public "/drivers" roster page exists in this codebase —
    // the team profile page's "Current Drivers" section is the actual public
    // surface that reflects active team_stints (not unstable_cache'd, so a
    // plain read is fresh).
    await page.goto(`/leagues/${leagueSlug}/teams/${teamBId}`);
    await expect(page.getByText("Alessandro Ferrari")).toBeVisible();

    await page.goto(`/leagues/${leagueSlug}/teams/${teamAId}`);
    await expect(page.getByText("Alessandro Ferrari")).not.toBeVisible();
  });

  // FINDING F2 (design doc §2), fixed: transfers/route.ts previously had no
  // lock/unique constraint on "one open stint per entry" — two concurrent
  // identical POSTs both read the same current stint, both close it
  // (idempotent update), and both inserted a new stint on the destination
  // team. Ran this assertion against the real app first (not assumed from
  // the design doc): openStints.length came back 2, not 1 — a genuine
  // product bug. Fixed with a partial unique index,
  // driver_team_stints_one_open_per_entry on (league_driver_entry_id) where
  // ends_on is null (migration 20260704000000), plus route handling: the
  // losing request's stint-insert now hits a 23505 unique violation, which
  // the route reports as a clean 409 without rolling back the winner's
  // close. Exactly one request should 200 and the other 409, leaving exactly
  // one open stint.
  test(
    "T15: transfer double-submit invariant (F2 — two concurrent transfers leave exactly one open stint)",
    async ({ request }) => {
      const headers = await csrfHeaders(request);
      const body = {
        driver_entry_id: driverEntryId,
        effective_date: "2025-06-02",
        new_team_id: teamAId,
      };

      const [resA, resB] = await Promise.all([
        request.post(`/api/admin/leagues/${leagueId}/transfers`, { headers, data: body }),
        request.post(`/api/admin/leagues/${leagueId}/transfers`, { headers, data: body }),
      ]);

      const statuses = [resA.status(), resB.status()].sort();
      expect(statuses).toEqual([200, 409]);

      const driversRes = await request.get(`/api/admin/leagues/${leagueId}/drivers`);
      const { drivers } = (await driversRes.json()) as {
        drivers: { id: string; driver_team_stints: { ends_on: string | null }[] }[];
      };
      const entry = drivers.find((d) => d.id === driverEntryId);
      const openStints = (entry?.driver_team_stints ?? []).filter((s) => s.ends_on === null);

      expect(openStints.length).toBe(1);
    },
  );

  test("T13: archiving is a one-way transition; reactivate (archived->active) is rejected (finding F5)", async ({
    page,
    request,
  }) => {
    const headers = await csrfHeaders(request);

    const archiveRes = await request.patch(`/api/admin/leagues/${leagueId}/status`, {
      headers,
      data: { status: "archived" },
    });
    expect(archiveRes.status()).toBe(200);

    // FINDING (design-doc deviation): src/app/page.tsx's homepage query is
    // `.neq("status","draft")`, identical to resolvePublicLeague — archived
    // leagues are NOT excluded from the homepage, only drafts are. The design
    // doc's "archive hides from homepage" assumption does not hold against
    // the real code; the actual contract is "still listed, marked Archived".
    await page.goto("/");
    await expect(page.getByText(leagueName)).toBeVisible();

    const reactivateRes = await request.patch(`/api/admin/leagues/${leagueId}/status`, {
      headers,
      data: { status: "active" },
    });
    expect(reactivateRes.status()).toBe(422);
  });
});
