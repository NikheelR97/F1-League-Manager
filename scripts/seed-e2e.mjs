/**
 * E2E test data seed script.
 *
 * Creates two Supabase auth users so Playwright can authenticate in tests:
 *   e2e-admin@test.local  — role: admin
 *   e2e-racer@test.local  — role: racer, linked to a driver in Informal League
 *
 * Idempotent: safe to re-run. Uses email as the stable lookup key for users,
 * profile_id as the unique key for drivers, and (league_id, driver_id, season_id)
 * for league_driver_entries. Does not rely on fixed UUIDs because local GoTrue
 * does not honour the user_id parameter in createUser.
 *
 * Run after `supabase db reset` or when E2E users are missing:
 *   npm run seed:e2e
 *
 * Credentials (local dev only — never use on staging or prod):
 *   Admin:  e2e-admin@test.local / E2eTestPassword!1
 *   Racer:  e2e-racer@test.local / E2eTestPassword!1
 */

import { createClient } from "@supabase/supabase-js";

// Must match supabase/seed.sql
const INFORMAL_LEAGUE_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SEASON_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const RED_RACING_TEAM_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const ADMIN_EMAIL = "e2e-admin@test.local";
const RACER_EMAIL = "e2e-racer@test.local";
const TEST_PASSWORD = "E2eTestPassword!1";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  console.error("Run with: npm run seed:e2e");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Find or create an auth user by email. Returns the user object with its actual ID.
 * Local GoTrue ignores user_id in createUser, so we never rely on fixed UUIDs here.
 */
async function upsertAuthUser(email, displayName) {
  // Try to find existing user by listing (no find-by-email endpoint on admin API)
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    // Always reset the password so credentials are guaranteed correct on re-runs
    const { error: pwErr } = await db.auth.admin.updateUserById(existing.id, { password: TEST_PASSWORD });
    if (pwErr) throw new Error(`resetPassword(${email}): ${pwErr.message}`);
    console.log(`  [skip] auth user ${email} already exists — password reset (id=${existing.id})`);
    return existing;
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  console.log(`  [ok]   created auth user ${email} (id=${data.user.id})`);
  return data.user;
}

async function run() {
  console.log("Seeding E2E test users...\n");

  // 1. Admin user
  const adminUser = await upsertAuthUser(ADMIN_EMAIL, "E2E Admin");

  // 2. Elevate to admin role (profile created by DB trigger on auth.users insert)
  const { error: roleErr } = await db
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", adminUser.id);
  if (roleErr) throw new Error(`update admin role: ${roleErr.message}`);
  console.log("  [ok]   admin profile role = admin");

  // 3. Racer user
  const racerUser = await upsertAuthUser(RACER_EMAIL, "E2E Racer");

  // 4. Ensure racer profile exists (trigger may not fire in all local GoTrue versions)
  const { error: racerProfileErr } = await db.from("profiles").upsert(
    { id: racerUser.id, role: "racer", display_name: "E2E Racer" },
    { onConflict: "id" },
  );
  if (racerProfileErr) throw new Error(`upsert racer profile: ${racerProfileErr.message}`);
  console.log("  [ok]   racer profile ensured");

  // 5. Driver record linked to racer — upsert on profile_id (unique)
  const { data: driver, error: driverErr } = await db
    .from("drivers")
    .upsert(
      {
        display_name: "E2E Racer",
        racing_number: 98,
        country: "United Kingdom",
        is_active: true,
        profile_id: racerUser.id,
      },
      { onConflict: "profile_id" },
    )
    .select("id")
    .single();
  if (driverErr) throw new Error(`upsert driver: ${driverErr.message}`);
  console.log(`  [ok]   racer driver upserted (id=${driver.id}, racing_number=98)`);

  // 6. Enrol driver in Informal League — upsert on (league_id, driver_id, season_id)
  const { data: lde, error: ldeErr } = await db
    .from("league_driver_entries")
    .upsert(
      {
        league_id: INFORMAL_LEAGUE_ID,
        season_id: SEASON_ID,
        driver_id: driver.id,
        is_reserve: false,
        joined_on: "2025-03-01",
      },
      { onConflict: "league_id,driver_id,season_id" },
    )
    .select("id")
    .single();
  if (ldeErr) throw new Error(`upsert league_driver_entry: ${ldeErr.message}`);
  console.log("  [ok]   racer enrolled in Informal League");

  // 7. Assign driver to Red Racing (only if no active stint exists)
  const { data: activeStint } = await db
    .from("driver_team_stints")
    .select("id")
    .eq("league_driver_entry_id", lde.id)
    .is("ends_on", null)
    .maybeSingle();

  if (!activeStint) {
    const { error: stintErr } = await db.from("driver_team_stints").insert({
      league_driver_entry_id: lde.id,
      team_id: RED_RACING_TEAM_ID,
      starts_on: "2025-03-01",
    });
    if (stintErr) throw new Error(`insert driver_team_stint: ${stintErr.message}`);
    console.log("  [ok]   racer assigned to Red Racing");
  } else {
    console.log("  [skip] racer team stint already exists");
  }

  console.log("\nE2E seed complete.");
  console.log(`  Admin : ${ADMIN_EMAIL}  /  ${TEST_PASSWORD}`);
  console.log(`  Racer : ${RACER_EMAIL}  /  ${TEST_PASSWORD}`);
}

run().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
