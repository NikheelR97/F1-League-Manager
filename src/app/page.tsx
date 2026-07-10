import "server-only";

import { LeagueCard } from "@/components/league/LeagueCard";
import { PublicShell } from "@/components/layout/PublicShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamBadge } from "@/components/ui/TeamBadge";
import {
  F1_INFORMAL_RACE_PCT,
  F1_STANDARD_RACE_PCT,
  MAX_PUBLIC_LEAGUE_CARDS,
} from "@/lib/constants";
import { getCurrentSeason } from "@/lib/leagues/get-current-season";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { LeagueSummary } from "@/lib/ui/league-data";

export const dynamic = "force-dynamic";

type Db = ReturnType<typeof createSupabaseServiceRoleClient>;

interface LeagueRow {
  id: string;
  name: string;
  slug: string;
  format: string;
  status: string;
}

// seasonId is null for a league with no current season (zero seasons, or all
// archived) — standings/next-race are skipped rather than queried, so the
// card still renders with the same "No results yet" / "TBD" fallbacks used
// when a season exists but has no data yet.
async function buildLeagueSummary(
  db: Db,
  league: LeagueRow,
  seasonId: string | null,
): Promise<LeagueSummary> {
  const [{ data: driverLeader }, { data: constructorLeader }, { data: nextRace }] = seasonId
    ? await Promise.all([
        db
          .from("driver_standings")
          .select("total_points, drivers(display_name)")
          .eq("league_id", league.id)
          .eq("season_id", seasonId)
          .order("position")
          .limit(1)
          .maybeSingle(),
        db
          .from("team_standings")
          .select("total_points, teams(name)")
          .eq("league_id", league.id)
          .eq("season_id", seasonId)
          .order("position")
          .limit(1)
          .maybeSingle(),
        db
          .from("race_sessions")
          .select("name, circuits(name)")
          .eq("league_id", league.id)
          .eq("season_id", seasonId)
          .eq("status", "scheduled")
          .order("scheduled_at")
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const driver = driverLeader?.drivers as unknown as { display_name: string } | null;
  const constructor = constructorLeader?.teams as unknown as { name: string } | null;
  const circuit = nextRace?.circuits as unknown as { name: string } | null;

  const isWheelFormat = league.format === "standard";

  return {
    constructorLeader: constructor?.name ?? "No results yet",
    formatLabel:
      league.format === "informal"
        ? `2 x ${F1_INFORMAL_RACE_PCT}% races`
        : league.format === "standard"
          ? `${F1_STANDARD_RACE_PCT}% feature race`
          : "Custom format",
    heroAlt: isWheelFormat
      ? "Race control garage with timing monitors beside a pit lane"
      : "Dusk race circuit pit straight with red timing lights",
    heroImage: isWheelFormat
      ? "/images/leagues/race-control-hero.png"
      : "/images/leagues/race-weekend-hero.png",
    href: `/leagues/${league.slug}`,
    leader: driver?.display_name ?? "No results yet",
    name: league.name,
    nextRace: circuit?.name ?? nextRace?.name ?? "TBD",
    slug: league.slug,
    status: league.status.charAt(0).toUpperCase() + league.status.slice(1),
  };
}

export default async function Home() {
  const db = createSupabaseServiceRoleClient();
  const { data: leagueRows } = await db
    .from("leagues")
    .select("id, name, slug, format, status")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(MAX_PUBLIC_LEAGUE_CARDS);

  // ponytail: fetch nav league links from the same query; cap at 3 for nav display
  const navLeagueRows = leagueRows?.slice(0, 3) ?? [];
  const navLeagueLinks = navLeagueRows.map((league: LeagueRow) => ({
    href: `/leagues/${league.slug}`,
    label: league.name,
  }));

  const leagues = await Promise.all(
    (leagueRows ?? []).map(async (league: LeagueRow) => {
      const season = await getCurrentSeason(db, league.id);
      return buildLeagueSummary(db, league, season?.id ?? null);
    }),
  );

  return (
    <PublicShell leagueLinks={navLeagueLinks}>
      <section className="surface-band">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <TeamBadge color="#E8002D" label="Race Weekend" />
            <h1 className="mt-5 text-4xl font-black uppercase text-f1-white sm:text-6xl">
              F1 Esports League Manager
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-f1-silver">
              League race hubs bring calendar readiness, standings status,
              penalties, and wheel state into one race-weekend view.
            </p>
          </div>
          <div className="grid gap-6">
            {leagues.length === 0 ? (
              <EmptyState title="No leagues yet" message="Public leagues will appear here once they are published." />
            ) : (
              leagues.map((league, index) => (
                <LeagueCard key={league.slug} league={league} priority={index === 0} />
              ))
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
