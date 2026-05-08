import { readdirSync, readFileSync } from "node:fs";

const migrationSql = readFileSync(
  "supabase/migrations/20260507161000_s1_core_schema.sql",
  "utf8",
);
const allMigrationSql = readdirSync("supabase/migrations")
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort()
  .map((fileName) => readFileSync(`supabase/migrations/${fileName}`, "utf8"))
  .join("\n");

const coreTables = [
  "profiles",
  "seasons",
  "leagues",
  "points_systems",
  "official_team_templates",
  "teams",
  "drivers",
  "league_driver_entries",
  "driver_team_stints",
  "race_reserve_assignments",
  "circuits",
  "league_circuit_pools",
  "race_sessions",
  "wheel_spins",
  "qualifying_results",
  "race_results",
  "penalties",
  "championship_adjustments",
  "driver_penalty_totals",
  "driver_standings",
  "team_standings",
  "vehicle_setups",
  "audit_logs",
  "workbook_migrations",
] as const;

describe("S1 database migration", () => {
  it("enables RLS on every core table", () => {
    expect.assertions(coreTables.length);

    for (const tableName of coreTables) {
      expect(migrationSql).toContain(
        `alter table public.${tableName} enable row level security;`,
      );
    }
  });

  it("seeds official teams and the full 2025 circuit library", () => {
    expect(migrationSql.match(/'#[0-9A-Fa-f]{6}'/gu)).toHaveLength(10);
    expect(migrationSql.match(/\(\d+, '[^']+', '[^']+'/gu)).toHaveLength(24);
    expect(migrationSql).toContain(
      "'Yas Marina Circuit', 'yas-marina', 'UAE'",
    );
  });

  it("keeps public reads scoped to non-draft leagues and safe penalty columns", () => {
    expect(allMigrationSql).toContain(
      "create policy public_read_leagues on public.leagues\n  for select using (status <> 'draft');",
    );
    expect(allMigrationSql).toContain("public.is_public_league(league_id)");
    expect(allMigrationSql).toContain(
      "revoke select on table public.penalties from anon, authenticated;",
    );
    expect(allMigrationSql).toContain(
      "grant select (\n  id,\n  league_id,\n  season_id,\n  driver_id,\n  race_session_id,\n  penalty_points,\n  reason,\n  status,\n  created_at\n) on public.penalties to anon, authenticated;",
    );
  });
});
