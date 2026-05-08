import "server-only";

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
  season: { id: string; name: string };
}

export async function resolvePublicLeague(slug: string): Promise<PublicLeague | null> {
  const db = createSupabaseServiceRoleClient();
  const { data } = await db
    .from("leagues")
    .select(
      "id, name, slug, format, status, fastest_lap_enabled, pole_position_enabled, constructor_championship_enabled, penalty_threshold, logo_path, hero_image_path, seasons(id, name)",
    )
    .eq("slug", slug)
    .neq("status", "draft")
    .single();

  if (!data) return null;

  const season = data.seasons as unknown as { id: string; name: string } | null;
  if (!season) return null;

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
    season,
  };
}
