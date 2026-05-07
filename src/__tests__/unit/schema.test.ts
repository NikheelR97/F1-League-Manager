import { readFileSync } from "node:fs";

const migrationSql = readFileSync(
  "supabase/migrations/20260507161000_s1_core_schema.sql",
  "utf8",
);

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
  });
});
