import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { SeasonSelector } from "@/components/league/SeasonSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { PositionDelta } from "@/components/ui/PositionDelta";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { resolveLeagueSeasons } from "@/lib/public/resolve-league-seasons";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConstructorStandingsPage({
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

  if (!league.constructor_championship_enabled) notFound();

  const rawSeason = typeof sp.season === "string" ? sp.season : null;
  const seasonId =
    rawSeason && UUID_RE.test(rawSeason) ? rawSeason : league.season.id;

  const db = createSupabaseServiceRoleClient();

  const [{ data: rows }, { data: lastSession }, seasons] = await Promise.all([
    db
      .from("team_standings")
      .select(
        "position, previous_position, total_points, wins, podiums, updated_at, teams(id, name, color_hex)",
      )
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .order("position")
      .limit(15),
    db
      .from("race_sessions")
      .select("name, published_at")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    resolveLeagueSeasons(league.id),
  ]);

  const standings = rows ?? [];
  const leaderPoints = standings[0]?.total_points ?? 0;
  const updatedAt = standings[0]?.updated_at ?? null;

  const displaySeason =
    seasons.find((s) => s.id === seasonId)?.name ?? league.season.name;

  type TeamRow = { id: string; name: string; color_hex: string };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={displaySeason}
        title="Constructor Standings"
        updatedAt={updatedAt}
      />

      <SeasonSelector
        currentSeasonId={seasonId}
        pathname={`/leagues/${slug}/standings/constructors`}
        seasons={seasons}
      />

      {standings.length === 0 ? (
        <EmptyState message="Constructor standings will appear once results are published." title="No standings yet" />
      ) : (
        <>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                <th className="w-10 pb-2 pr-4">Pos</th>
                <th className="w-6 pb-2 pr-4" aria-label="Change" />
                <th className="pb-2 pr-4">Constructor</th>
                <th className="pb-2 pr-4 text-right">Pts</th>
                <th className="pb-2 pr-4 text-right">Gap</th>
                <th className="pb-2 pr-4 text-right">W</th>
                <th className="pb-2 text-right">Pod</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const team = row.teams as unknown as TeamRow | null;
                const gap = row.position === 1 ? "-" : `-${leaderPoints - row.total_points}`;
                return (
                  <tr key={row.position} className="border-b border-f1-border/40 hover:bg-f1-dark">
                    <td className="py-2 pr-4 font-mono font-bold text-f1-white">{row.position}</td>
                    <td className="py-2 pr-4">
                      <PositionDelta current={row.position} previous={row.previous_position} />
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
                            className="font-bold text-f1-white hover:text-f1-red"
                            href={`/leagues/${league.slug}/teams/${team.id}`}
                          >
                            {team.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-f1-white">TBD</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono font-bold text-f1-white">{row.total_points}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-muted">{gap}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-white">{row.wins}</td>
                    <td className="py-2 text-right font-mono text-xs text-f1-white">{row.podiums}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="space-y-2 md:hidden">
            {standings.map((row) => {
              const team = row.teams as unknown as TeamRow | null;
              const gap = row.position === 1 ? "Leader" : `-${leaderPoints - row.total_points} pts`;
              return (
                <li key={row.position} className="border border-f1-border bg-f1-dark p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-lg font-bold text-f1-white">{row.position}</span>
                      <PositionDelta current={row.position} previous={row.previous_position} />
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-4 w-1 shrink-0"
                          style={{ backgroundColor: team?.color_hex ?? "#444" }}
                        />
                        {team ? (
                          <Link
                            className="font-bold text-f1-white"
                            href={`/leagues/${league.slug}/teams/${team.id}`}
                          >
                            {team.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-f1-white">TBD</span>
                        )}
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
