import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export interface LeagueSeason {
  id: string;
  name: string;
}

/**
 * Returns all seasons that have published race sessions for the given league,
 * ordered newest first. Used to populate the season selector on public pages.
 */
export async function resolveLeagueSeasons(
  leagueId: string,
): Promise<LeagueSeason[]> {
  const db = createSupabaseServiceRoleClient();

  const { data } = await db
    .from("race_sessions")
    .select("season_id, seasons(id, name)")
    .eq("league_id", leagueId)
    .eq("status", "completed")
    .limit(200);

  if (!data) return [];

  // Deduplicate by season id, preserving insertion order (newest first from DB)
  const seen = new Set<string>();
  const seasons: LeagueSeason[] = [];

  for (const row of data) {
    const season = row.seasons as unknown as { id: string; name: string } | null;
    if (!season || seen.has(season.id)) continue;
    seen.add(season.id);
    seasons.push({ id: season.id, name: season.name });
  }

  return seasons;
}
