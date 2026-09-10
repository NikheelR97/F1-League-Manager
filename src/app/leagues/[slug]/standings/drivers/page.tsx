import "server-only";

import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeasonSelector } from "@/components/league/SeasonSelector";
import { StandingsCard } from "@/components/league/StandingsCard";
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

  const siteLabel = (process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // Positions 1-3 get the podium ramp. It is the fastest read in the table and
  // survives the heavy recompression Discord/WhatsApp apply to screenshots.
  const podiumClass = (position: number) =>
    position === 1
      ? "text-podium-gold"
      : position === 2
        ? "text-podium-silver"
        : position === 3
          ? "text-podium-bronze"
          : "text-f1-silver";

  // Zeros are the common case; dimming them lets real achievements carry the eye.
  const statClass = (value: number) => (value > 0 ? "font-bold text-f1-white" : "text-f1-mid");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
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

          <StandingsCard
            footerNote="Ties broken by wins, then podiums."
            lastRound={lastSession?.name ?? null}
            leagueName={league.name}
            seasonName={displaySeason}
            siteLabel={siteLabel}
            title="Driver Standings"
            updatedAt={updatedAt}
          >
            <table className="hidden w-full md:table">
              <thead>
                <tr className="border-b border-f1-border bg-black/25 text-[10px] font-bold uppercase tracking-wider text-f1-muted">
                  <th className="w-12 py-2 text-center" scope="col">Pos</th>
                  <th className="w-5" aria-label="Change" scope="col" />
                  <th className="py-2 pl-1 text-left" scope="col">Driver</th>
                  <th className="w-[150px] py-2 text-left" scope="col">Team</th>
                  <th className="w-16 py-2 text-right" scope="col">Pts</th>
                  <th className="w-[76px] py-2 pr-1 text-right" scope="col">Gap</th>
                  <th className="w-9 py-2 text-right" scope="col">W</th>
                  <th className="w-9 py-2 text-right" scope="col">Pod</th>
                  <th className="w-9 py-2 pr-4 text-right" scope="col">FL</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const driver = row.drivers as unknown as DriverRow | null;
                  const team = row.teams as unknown as TeamRow | null;
                  const gap = formatGap(leaderPoints, row.total_points, row.position);
                  return (
                    <tr
                      key={row.position}
                      className={`h-[33px] border-b border-f1-border/50 transition-colors even:bg-white/[0.018] hover:bg-white/[0.05] ${
                        row.position === 1
                          ? "bg-[linear-gradient(90deg,rgba(245,196,81,0.15),transparent_46%)]"
                          : ""
                      }`}
                      data-driver-name={driver?.display_name.toLowerCase()}
                    >
                      <td className={`text-center font-mono text-[15px] font-bold ${podiumClass(row.position)}`}>
                        {row.position}
                      </td>
                      <td>
                        <div className="flex justify-center">
                          <PositionDelta compact current={row.position} previous={row.previous_position} />
                        </div>
                      </td>
                      <td className="pl-1">
                        {driver ? (
                          <Link
                            className="flex h-[33px] items-center text-[14.5px] font-bold text-f1-white hover:text-f1-red-text"
                            href={`/leagues/${league.slug}/drivers/${driver.id}`}
                          >
                            {driver.display_name}
                            {driver.racing_number ? (
                              <span className="ml-1.5 font-mono text-[11px] font-normal text-f1-muted">
                                #{driver.racing_number}
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          <span className="text-[14.5px] font-bold text-f1-white">TBD</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-[17px] w-1 shrink-0 ring-1 ring-white/25"
                            style={{ backgroundColor: team?.color_hex ?? "#444" }}
                          />
                          {team ? (
                            <Link
                              className="flex h-[33px] items-center truncate text-[12.5px] font-semibold text-f1-silver hover:text-f1-white"
                              href={`/leagues/${league.slug}/teams/${team.id}`}
                            >
                              {team.name}
                            </Link>
                          ) : (
                            <span className="text-[12.5px] font-semibold text-f1-muted">TBD</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right font-mono text-[16.5px] font-bold text-f1-white">
                        {row.total_points}
                      </td>
                      <td
                        className={`pr-1 text-right font-mono text-xs ${
                          row.position === 1 ? "font-bold text-podium-gold" : "text-f1-silver"
                        }`}
                      >
                        {gap}
                      </td>
                      <td className={`text-right font-mono text-xs ${statClass(row.wins)}`}>{row.wins}</td>
                      <td className={`text-right font-mono text-xs ${statClass(row.podiums)}`}>{row.podiums}</td>
                      <td className={`pr-4 text-right font-mono text-xs ${statClass(row.fastest_laps)}`}>
                        {row.fastest_laps}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-f1-border/50 md:hidden">
              {standings.map((row) => {
                const driver = row.drivers as unknown as DriverRow | null;
                const team = row.teams as unknown as TeamRow | null;
                const gap = formatGap(leaderPoints, row.total_points, row.position);
                return (
                  <li
                    key={row.position}
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      row.position === 1
                        ? "bg-[linear-gradient(90deg,rgba(245,196,81,0.15),transparent_58%)]"
                        : ""
                    }`}
                    data-driver-name={driver?.display_name.toLowerCase()}
                  >
                    <span
                      className={`w-6 shrink-0 text-center font-mono text-base font-bold ${podiumClass(row.position)}`}
                    >
                      {row.position}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-8 w-1 shrink-0 ring-1 ring-white/25"
                      style={{ backgroundColor: team?.color_hex ?? "#444" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {driver ? (
                          <Link
                            className="truncate font-bold text-f1-white"
                            href={`/leagues/${league.slug}/drivers/${driver.id}`}
                          >
                            {driver.display_name}
                          </Link>
                        ) : (
                          <span className="font-bold text-f1-white">TBD</span>
                        )}
                        <PositionDelta compact current={row.position} previous={row.previous_position} />
                      </div>
                      <p className="truncate text-xs text-f1-silver">
                        {team?.name ?? "TBD"}
                        <span className="text-f1-muted">
                          {" · "}
                          {row.wins}W · {row.podiums} Pod · {row.fastest_laps} FL
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-lg font-bold leading-none text-f1-white">
                        {row.total_points}
                      </p>
                      <p
                        className={`mt-1 font-mono text-[11px] ${
                          row.position === 1 ? "font-bold text-podium-gold" : "text-f1-silver"
                        }`}
                      >
                        {gap}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </StandingsCard>
        </>
      )}
    </div>
  );
}
