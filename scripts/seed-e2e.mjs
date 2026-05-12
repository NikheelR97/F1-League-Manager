/**
 * E2E test data seed script.
 *
 * Creates two Supabase auth users with fixed UUIDs so the script is idempotent:
 *   e2e-admin@test.local  — role: admin
 *   e2e-racer@test.local  — role: racer, linked to a driver in Informal League
 *
 * Run after `supabase db reset` or when E2E users are missing:
 *   node --env-file=.env.local scripts/seed-e2e.mjs
 *
 * Credentials (local dev only — never use on staging or prod):
 *   Admin:  e2e-admin@test.local / E2eTestPassword!1
 *   Racer:  e2e-racer@test.local / E2eTestPassword!1
 */

import { createClient } from "@supabase/supabase-js";

// Fixed UUIDs — must stay stable so tests and storage state files stay valid
const E2E_ADMIN_ID = "10000000-0000-0000-0000-000000000001";
const E2E_RACER_ID = "10000000-0000-0000-0000-000000000002";
const E2E_RACER_DRIVER_ID = "10000000-0000-0000-0000-000000000003";
const E2E_LDE_ID = "10000000-0000-0000-0000-000000000004";
const E2E_STINT_ID = "10000000-0000-0000-0000-000000000005";

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
  console.error("Run with: node --env-file=.env.local scripts/seed-e2e.mjs");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Create an auth user with a fixed UUID if it does not already exist.
 * Uses getUserById so the check is O(1) and idempotent.
 */
async function upsertAuthUser(userId, email, displayName) {
  const { data: existing } = await db.auth.admin.getUserById(userId);
  if (existing?.user) {
    console.log(`  [skip] auth user ${email} already exists`);
    return existing.user;
  }

  const { data, error } = await db.auth.admin.createUser({
    user_id: userId,
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  console.log(`  [ok]   created auth user ${email}`);
  return data.user;
}

async function run() {
  console.log("Seeding E2E test users...\n");

  // 1. Admin user — trigger auto-creates profile with role=racer
  await upsertAuthUser(E2E_ADMIN_ID, ADMIN_EMAIL, "E2E Admin");

  // 2. Elevate to admin role
  const { error: roleErr } = await db
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", E2E_ADMIN_ID);
  if (roleErr) throw new Error(`update admin role: ${roleErr.message}`);
  console.log("  [ok]   admin profile role = admin");

  // 3. Racer user — stays at role=racer (default from trigger)
  await upsertAuthUser(E2E_RACER_ID, RACER_EMAIL, "E2E Racer");

  // 4. Driver record linked to racer's profile
  const { error: driverErr } = await db.from("drivers").upsert(
    {
      id: E2E_RACER_DRIVER_ID,
      display_name: "E2E Racer",
      racing_number: 98,
      country: "United Kingdom",
      is_active: true,
      profile_id: E2E_RACER_ID,
    },
    { onConflict: "id" },
  );
  if (driverErr) throw new Error(`upsert driver: ${driverErr.message}`);
  console.log("  [ok]   racer driver upserted (racing_number=98)");

  // 5. Enrol driver in Informal League for the current season
  const { error: ldeErr } = await db.from("league_driver_entries").upsert(
    {
      id: E2E_LDE_ID,
      league_id: INFORMAL_LEAGUE_ID,
      season_id: SEASON_ID,
      driver_id: E2E_RACER_DRIVER_ID,
      is_reserve: false,
      joined_on: "2025-03-01",
    },
    { onConflict: "id" },
  );
  if (ldeErr) throw new Error(`upsert league_driver_entry: ${ldeErr.message}`);
  console.log("  [ok]   racer enrolled in Informal League");

  // 6. Assign driver to Red Racing
  const { error: stintErr } = await db.from("driver_team_stints").upsert(
    {
      id: E2E_STINT_ID,
      league_driver_entry_id: E2E_LDE_ID,
      team_id: RED_RACING_TEAM_ID,
      starts_on: "2025-03-01",
    },
    { onConflict: "id" },
  );
  if (stintErr) throw new Error(`upsert driver_team_stint: ${stintErr.message}`);
  console.log("  [ok]   racer assigned to Red Racing\n");

  console.log("E2E seed complete.");
  console.log(`  Admin : ${ADMIN_EMAIL}  /  ${TEST_PASSWORD}`);
  console.log(`  Racer : ${RACER_EMAIL}  /  ${TEST_PASSWORD}`);
}

run().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
