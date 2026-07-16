import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const NAV_LEAGUE_COUNT = 3;

export interface NavLeagueLink {
  href: string;
  label: string;
}

// Shared by every PublicHeader caller (homepage, league layout) so the nav's
// league links come from one query instead of being duplicated per caller.
export async function getNavLeagueLinks(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
): Promise<NavLeagueLink[]> {
  const { data } = await db
    .from("leagues")
    .select("name, slug")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(NAV_LEAGUE_COUNT);

  return (data ?? []).map((league) => ({
    href: `/leagues/${league.slug}`,
    label: league.name,
  }));
}
