import "server-only";

import type { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type CurrentSeason = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string | null;
  is_current: boolean;
};

/**
 * Resolves a league's current season (seasons.league_id = ? and is_current),
 * or null if the league has no current season (e.g. brand new league with
 * zero seasons, or all seasons archived without a new one set current).
 */
export async function getCurrentSeason(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  leagueId: string,
): Promise<CurrentSeason | null> {
  const { data, error } = await db
    .from("seasons")
    .select("id, name, starts_on, ends_on, is_current")
    .eq("league_id", leagueId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
