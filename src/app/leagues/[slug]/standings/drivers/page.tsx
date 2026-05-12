import "server-only";

import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { SeasonSelector } from "@/components/league/SeasonSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { PositionDelta } from "@/components/ui/PositionDelta";
import { cacheTag } from "@/lib/cache/tags";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { resolveLeagueSeasons } from "@/lib/public/resolve-league-seasons";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    rawSeason && UUID_RE.test(rawSeason) ? rawSeason : league.season.id;

  const fetchStandingsData = unstable_cache(
    async (leagueId: string, sid: string) => {
      const db = createSupabaseServiceRoleClient();
      const [{ data: rows }, { data: lastSession }] = await Promise.all([
        db
          .from("driver_standings")
          .select(
            "position, previous_position, total_points, wins, podiums, fastest_laps, updated_at, drivers(id, display_name, racing_number), teams(id, name, color_hex)",
          )
          .eq("league_id", leagueId)
          .eq("season_id", sid)
          .order("position")
          .limit(50),
        db
          .from("race_sessions")
          .select("name, published_at")
          .eq("league_id", leagueId)
          .eq("season_id", sid)
          .eq("status", "completed")
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { rows: rows ?? [], lastSession };
    },
    [`driver-standings:${league.id}:${seasonId}`],
    { tags: [cacheTag.standings(league.id)] },
  );

  const [{ rows, lastSession }, seasons] = await Promise.all([
    fetchStandingsData(league.id, seasonId),
    resolveLeagueSeasons(league.id),
  ]);

  const standings = rows ?? [];
  const leaderPoints = standings[0]?.total_points ?? 0;
  const updatedAt = standings[0]?.updated_at ?? null;

  // Determine the display season name (may differ from league.season.name when browsing history)
  const displaySeason =
    seasons.find((s) => s.id === seasonId)?.name ?? league.season.name;

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
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                <th className="w-10 pb-2 pr-4">Pos</th>
                <th className="w-6 pb-2 pr-4" aria-label="Change" />
                <th className="pb-2 pr-4">Driver</th>
                <th className="pb-2 pr-4">Team</th>
                <th className="pb-2 pr-4 text-right">Pts</th>
                <th className="pb-2 pr-4 text-right">Gap</th>
                <th className="pb-2 pr-4 text-right">W</th>
                <th className="pb-2 pr-4 text-right">Pod</th>
                <th className="pb-2 text-right">FL</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const driver = row.drivers as unknown as DriverRow | null;
                const team = row.teams as unknown as TeamRow | null;
                const gap = row.position === 1 ? "-" : `-${leaderPoints - row.total_points}`;
                return (
                  <tr key={row.position} className="border-b border-f1-border/40 hover:bg-f1-dark">
                    <td className="py-2 pr-4 font-mono font-bold text-f1-white">{row.position}</td>
                    <td className="py-2 pr-4">
                      <PositionDelta current={row.position} previous={row.previous_position} />
                    </td>
                    <td className="py-2 pr-4">
                      {driver ? (
                        <Link
                          className="font-bold text-f1-white hover:text-f1-red"
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
                            className="text-f1-muted hover:text-f1-white"
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
              const gap = row.position === 1 ? "Leader" : `-${leaderPoints - row.total_points} pts`;
              return (
                <li key={row.position} className="border border-f1-border bg-f1-dark p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-lg font-bold text-f1-white">{row.position}</span>
                      <PositionDelta current={row.position} previous={row.previous_position} />
                      <div>
                        <p className="font-bold text-f1-white">
                          {driver ? (
                            <Link href={`/leagues/${league.slug}/drivers/${driver.id}`}>
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
                            <Link href={`/leagues/${league.slug}/teams/${team.id}`}>{team.name}</Link>
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
        </>
      )}
    </div>
  );
}
