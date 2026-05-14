import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export interface LeagueSeason {
  id: string;
  name: string;
}

interface ResolveLeagueSeasonsOptions {
  fallbackSeason?: LeagueSeason;
}

/**
 * Returns all seasons that have published race sessions for the given league,
 * ordered newest first. Always includes the fallback/current season when given
 * so public pages can navigate back to historical seasons before the current
 * season has completed sessions.
 */
export async function resolveLeagueSeasons(
  leagueId: string,
  options: ResolveLeagueSeasonsOptions = {},
): Promise<LeagueSeason[]> {
  const db = createSupabaseServiceRoleClient();

  const { data } = await db
    .from("race_sessions")
    .select("season_id, seasons(id, name)")
    .eq("league_id", leagueId)
    .eq("status", "completed")
    .order("published_at", { ascending: false })
    .limit(200);

  // Deduplicate by season id, preserving insertion order (newest first from DB)
  const seen = new Set<string>();
  const seasons: LeagueSeason[] = [];

  function addSeason(season: LeagueSeason | null | undefined) {
    if (!season || seen.has(season.id)) return;
    seen.add(season.id);
    seasons.push({ id: season.id, name: season.name });
  }

  addSeason(options.fallbackSeason);

  for (const row of data ?? []) {
    const season = row.seasons as unknown as { id: string; name: string } | null;
    addSeason(season);
  }

  return seasons;
}
