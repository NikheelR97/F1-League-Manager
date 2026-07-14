import "server-only";

import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { SeasonSelector } from "@/components/league/SeasonSelector";
import { StandingsSearch } from "@/components/league/StandingsSearch";
import { EmptyState } from "@/components/ui/EmptyState";
import { PositionDelta } from "@/components/ui/PositionDelta";
import { cacheTag } from "@/lib/cache/tags";
import { formatGap } from "@/lib/format-gap";
import { pageTitle } from "@/lib/public/page-title";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { resolveLeagueSeasons, type LeagueSeason } from "@/lib/public/resolve-league-seasons";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  return { title: pageTitle(league ? `Driver Standings — ${league.name}` : "Driver Standings") };
}

// Fallback revalidation window: self-heals standings even if a mutation
// route misses the tag.
//
// ponytail note: revalidateTag() here is stale-while-revalidate, not a sync
// purge — the first request right after a publish can render one stale read
// before a background refetch catches up (~1-2s in manual testing). See the
// longer note on the league hub page (src/app/leagues/[slug]/page.tsx) for
// why, and why there's no framework API to make it synchronous here.
const STANDINGS_REVALIDATE_SECONDS = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Data-fetching only — no cookies/headers/auth touched here, so this is safe
// to wrap in unstable_cache. The service-role client is created inside so it
// participates in the cached call rather than being reused across cache keys.
async function getDriverStandingsData(
  leagueId: string,
  seasonId: string,
  fallbackSeason: LeagueSeason | null,
) {
  const db = createSupabaseServiceRoleClient();

  const [{ data: rows }, { data: lastSession }, seasons] = await Promise.all([
    db
      .from("driver_standings")
      .select(
        "position, previous_position, total_points, wins, podiums, fastest_laps, updated_at, drivers(id, display_name, racing_number), teams(id, name, color_hex)",
      )
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position")
      .limit(50),
    db
      .from("race_sessions")
      .select("name, published_at")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    resolveLeagueSeasons(leagueId, { fallbackSeason }),
  ]);

  return { rows: rows ?? [], lastSession: lastSession ?? null, seasons };
}

export default async function DriverStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  // Resolve the requested season — fall back to the league's current season
  const rawSeason = typeof sp.season === "string" ? sp.season : null;
  const seasonId =
    rawSeason && UUID_RE.test(rawSeason) ? rawSeason : league.season?.id;

  if (!seasonId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          message="This league doesn't have an active season yet. Check back soon."
          title="No season yet"
        />
      </div>
    );
  }

  const getCachedDriverStandings = unstable_cache(
    getDriverStandingsData,
    ["driver-standings"],
    {
      revalidate: STANDINGS_REVALIDATE_SECONDS,
      tags: [cacheTag.standings(league.id)],
    },
  );

  const { rows, lastSession, seasons } = await getCachedDriverStandings(
    league.id,
    seasonId,
    league.season,
  );

  const standings = rows;
  const leaderPoints = standings[0]?.total_points ?? 0;
  const updatedAt = standings[0]?.updated_at ?? null;
  const displaySeason =
    seasons.find((s) => s.id === seasonId)?.name ?? league.season?.name ?? "";

  type DriverRow = { id: string; display_name: string; racing_number: number | null };
  type TeamRow = { id: string; name: string; color_hex: string };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={displaySeason}
        title="Driver Standings"
        updatedAt={updatedAt}
      />

      <SeasonSelector
        currentSeasonId={seasonId}
        pathname={`/leagues/${slug}/standings/drivers`}
        seasons={seasons}
      />

      {standings.length === 0 ? (
        <EmptyState message="Standings will appear once results are published." title="No standings yet" />
      ) : (
        <>
          <StandingsSearch />
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                <th className="w-10 pb-2 pr-4" scope="col">Pos</th>
                <th className="w-6 pb-2 pr-4" aria-label="Change" scope="col" />
                <th className="pb-2 pr-4" scope="col">Driver</th>
                <th className="pb-2 pr-4" scope="col">Team</th>
                <th className="pb-2 pr-4 text-right" scope="col">Pts</th>
                <th className="pb-2 pr-4 text-right" scope="col">Gap</th>
                <th className="pb-2 pr-4 text-right" scope="col">W</th>
                <th className="pb-2 pr-4 text-right" scope="col">Pod</th>
                <th className="pb-2 text-right" scope="col">FL</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const driver = row.drivers as unknown as DriverRow | null;
                const team = row.teams as unknown as TeamRow | null;
                const gap = formatGap(leaderPoints, row.total_points, row.position);
                return (
                  <tr key={row.position} className="border-b border-f1-border/40 hover:bg-f1-dark" data-driver-name={driver?.display_name.toLowerCase()}>
                    <td className="py-2 pr-4 font-mono font-bold text-f1-white">{row.position}</td>
                    <td className="py-2 pr-4">
                      <PositionDelta current={row.position} previous={row.previous_position} />
                    </td>
                    <td className="py-2 pr-4">
                      {driver ? (
                        <Link
                          className="inline-flex items-center min-h-11 font-bold text-f1-white hover:text-f1-red"
                          href={`/leagues/${league.slug}/drivers/${driver.id}`}
                        >
                          {driver.display_name}
                        </Link>
                      ) : (
                        <span className="font-bold text-f1-white">TBD</span>
                      )}
                      {driver?.racing_number ? (
                        <span className="ml-2 font-mono text-xs text-f1-muted">#{driver.racing_number}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-1 shrink-0"
                          style={{ backgroundColor: team?.color_hex ?? "#444" }}
                        />
                        {team ? (
                          <Link
                            className="inline-flex items-center min-h-11 text-f1-muted hover:text-f1-white"
                            href={`/leagues/${league.slug}/teams/${team.id}`}
                          >
                            {team.name}
                          </Link>
                        ) : (
                          <span className="text-f1-muted">TBD</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono font-bold text-f1-white">{row.total_points}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-muted">{gap}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-white">{row.wins}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-white">{row.podiums}</td>
                    <td className="py-2 text-right font-mono text-xs text-f1-white">{row.fastest_laps}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="space-y-2 md:hidden">
            {standings.map((row) => {
              const driver = row.drivers as unknown as DriverRow | null;
              const team = row.teams as unknown as TeamRow | null;
              const gap = formatGap(leaderPoints, row.total_points, row.position);
              return (
                <li key={row.position} className="border border-f1-border bg-f1-dark p-3" data-driver-name={driver?.display_name.toLowerCase()}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-lg font-bold text-f1-white">{row.position}</span>
                      <PositionDelta current={row.position} previous={row.previous_position} />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-f1-white">
                          {driver ? (
                            <Link className="inline-flex items-center min-h-11" href={`/leagues/${league.slug}/drivers/${driver.id}`}>
                              {driver.display_name}
                            </Link>
                          ) : (
                            "TBD"
                          )}
                          {driver?.racing_number ? (
                            <span className="ml-2 font-mono text-xs text-f1-muted">#{driver.racing_number}</span>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-f1-muted">
                          <span
                            aria-hidden="true"
                            className="h-2 w-1 shrink-0"
                            style={{ backgroundColor: team?.color_hex ?? "#444" }}
                          />
                          {team ? (
                            <Link className="inline-flex items-center min-h-11" href={`/leagues/${league.slug}/teams/${team.id}`}>{team.name}</Link>
                          ) : (
                            "TBD"
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-f1-white">{row.total_points} pts</p>
                      <p className="font-mono text-xs text-f1-muted">{gap}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 font-mono text-xs text-f1-muted">
                    <span>{row.wins}W</span>
                    <span>{row.podiums} Pod</span>
                    <span>{row.fastest_laps} FL</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Tiebreak note */}
          <p className="text-xs text-f1-muted">Ties broken by wins, then podiums.</p>
        </>
      )}
    </div>
  );
}
