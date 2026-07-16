import "server-only";

import { cache } from "react";

import { getCurrentSeason } from "@/lib/leagues/get-current-season";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export interface PublicLeague {
  id: string;
  name: string;
  slug: string;
  format: string;
  status: string;
  fastest_lap_enabled: boolean;
  pole_position_enabled: boolean;
  constructor_championship_enabled: boolean;
  penalty_threshold: number;
  logo_path: string | null;
  hero_image_path: string | null;
  // null for a league with zero seasons or all seasons archived — callers
  // must degrade to an empty state rather than assume this is set.
  season: { id: string; name: string } | null;
}

// cache() dedupes same-request calls by slug — the layout and each page under
// it both resolve the league, so this collapses that to one query per request.
export const resolvePublicLeague = cache(async (slug: string): Promise<PublicLeague | null> => {
  const db = createSupabaseServiceRoleClient();
  const { data } = await db
    .from("leagues")
    .select(
      "id, name, slug, format, status, fastest_lap_enabled, pole_position_enabled, constructor_championship_enabled, penalty_threshold, logo_path, hero_image_path",
    )
    .eq("slug", slug)
    .neq("status", "draft")
    .single();

  if (!data) return null;

  // League's current season is derived (seasons.league_id + is_current), not
  // a dropped leagues.season_id FK — see get-current-season.ts.
  const season = await getCurrentSeason(db, data.id);

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    format: data.format,
    status: data.status,
    fastest_lap_enabled: data.fastest_lap_enabled,
    pole_position_enabled: data.pole_position_enabled,
    constructor_championship_enabled: data.constructor_championship_enabled,
    penalty_threshold: data.penalty_threshold,
    logo_path: data.logo_path,
    hero_image_path: data.hero_image_path,
    season: season ? { id: season.id, name: season.name } : null,
  };
});
