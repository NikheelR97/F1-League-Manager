import "server-only";

import type { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export interface DriverPenaltyTotal {
  penaltyPoints: number;
  banThresholdReached: boolean;
}

// Single source of truth for "how many penalty points does this driver have".
// Reads the precomputed driver_penalty_totals table (includes carry-over from
// prior seasons) instead of re-summing the penalties table, which excludes
// carry-over and disagrees with this table — see B12.
export async function getDriverPenaltyTotals(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  leagueId: string,
  seasonId: string,
): Promise<Map<string, DriverPenaltyTotal>> {
  const { data } = await db
    .from("driver_penalty_totals")
    .select("driver_id, penalty_points, ban_threshold_reached")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId);

  return new Map(
    (data ?? []).map((row) => [
      row.driver_id,
      { penaltyPoints: row.penalty_points, banThresholdReached: row.ban_threshold_reached },
    ]),
  );
}
