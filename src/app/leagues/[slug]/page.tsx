import "server-only";

import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { LeagueHub } from "@/components/league/LeagueHub";
import { cacheTag } from "@/lib/cache/tags";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// Fallback revalidation window: self-heals the hub if a mutation route ever
// misses a tag. Session create/update/delete and wheel confirm revalidate
// results/wheel tags; publish revalidates the rest.
const HUB_REVALIDATE_SECONDS = 300;

interface LeaguePageProps {
  params: Promise<{ slug: string }>;
}

// Data-fetching only — no cookies/headers/auth touched here, so this is safe
// to wrap in unstable_cache. The service-role client is created inside so it
// participates in the cached call rather than being reused across cache keys.
async function getLeagueHubData(leagueId: string, seasonId: string, isWheelLeague: boolean) {
  const db = createSupabaseServiceRoleClient();

  const [
    { data: nextRace },
    { data: latestSession },
    { data: topDrivers },
    { data: topConstructors },
    { data: penaltyAlerts },
    { data: latestWheelSpin },
    { count: wheelPoolRemaining },
  ] = await Promise.all([
    db
      .from("race_sessions")
      .select("id, name, scheduled_at, circuits(name, country)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("status", "scheduled")
      .order("scheduled_at")
      .limit(1)
      .maybeSingle(),
    db
      .from("race_sessions")
      .select("id, name, race_number, published_at, circuits(name)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("driver_standings")
      .select("position, previous_position, total_points, wins, drivers(id, display_name, racing_number), teams(id, name, color_hex)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position")
      .limit(5),
    db
      .from("team_standings")
      .select("position, previous_position, total_points, wins, teams(id, name, color_hex)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position")
      .limit(5),
    db
      .from("driver_penalty_totals")
      .select("driver_id, penalty_points, drivers(display_name)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("ban_threshold_reached", true)
      .order("penalty_points", { ascending: false })
      .limit(10),
    isWheelLeague
      ? db
          .from("wheel_spins")
          .select("id, confirmed_at, circuits(name, country)")
          .eq("league_id", leagueId)
          .eq("season_id", seasonId)
          .eq("status", "confirmed")
          .order("confirmed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isWheelLeague
      ? db
          .from("league_circuit_pools")
          .select("id", { count: "exact", head: true })
          .eq("league_id", leagueId)
          .eq("is_available", true)
          .is("used_at", null)
      : Promise.resolve({ count: null }),
  ]);

  return {
    latestSession: latestSession ?? null,
    latestWheelSpin: latestWheelSpin ?? null,
    nextRace: nextRace ?? null,
    penaltyAlerts: penaltyAlerts ?? [],
    topConstructors: topConstructors ?? [],
    topDrivers: topDrivers ?? [],
    wheelPoolRemaining: isWheelLeague ? (wheelPoolRemaining ?? 0) : null,
  };
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { slug } = await params;
  // ponytail: resolvePublicLeague itself stays uncached, by choice not by
  // blocker. Checked: `leagues.slug` is `unique` (20260507161000_s1_core_schema.sql),
  // so this is a single indexed lookup, and it runs exactly once per request
  // (no shared layout under leagues/[slug], no generateMetadata reusing it) —
  // there's nothing to dedupe and nothing measurably slow to cache. Slugs are
  // also immutable post-creation (no rename route exists) and leagues are
  // never deleted, so a coarse slug->id cache would even be *safe* to add —
  // it just isn't worth wiring revalidation into the create/status routes to
  // save a sub-millisecond unique-index hit. The downstream cached data below
  // (standings/results/wheel joins) is where the real traffic savings are.
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const isWheelLeague = league.format === "standard";

  // All tags here are revalidated by mutation routes: publish covers
  // standings/results/penalties, session create/update/delete and wheel
  // confirm cover results/wheel, asset uploads and transfers cover league.
  // penalties(leagueId) is included because this query also feeds the
  // penalty-watch banner.
  //
  // ponytail gap: revalidateTag() on this force-dynamic route is
  // stale-while-revalidate, not a synchronous purge — unstable_cache only
  // blocks for a fresh read during static generation (workStore.isStaticGeneration),
  // which force-dynamic pages never are. Measured in a manual E2E run: the
  // very first public request right after a publish can still render the
  // pre-publish cached value while a background refetch runs; a follow-up
  // request ~1-2s later reliably sees the fresh data (well under the 5-minute
  // fallback above). No Next.js API available in a Route Handler forces a
  // synchronous purge here (`updateTag` exists for that but is restricted to
  // Server Actions) — this ~1-2s eventual-consistency window is an inherent
  // trade-off of unstable_cache + revalidateTag on dynamic routes, not a bug.
  const getCachedHubData = unstable_cache(getLeagueHubData, ["league-hub"], {
    revalidate: HUB_REVALIDATE_SECONDS,
    tags: [
      cacheTag.standings(league.id),
      cacheTag.league(league.id),
      cacheTag.results(league.id),
      cacheTag.wheel(league.id),
      cacheTag.penalties(league.id),
    ],
  });

  const data = await getCachedHubData(league.id, league.season.id, isWheelLeague);

  return (
    <LeagueHub
      latestSession={data.latestSession}
      latestWheelSpin={data.latestWheelSpin}
      league={league}
      nextRace={data.nextRace}
      penaltyAlerts={data.penaltyAlerts}
      topConstructors={data.topConstructors}
      topDrivers={data.topDrivers}
      wheelPoolRemaining={data.wheelPoolRemaining}
    />
  );
}
