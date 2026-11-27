import "server-only";

import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeasonSelector } from "@/components/league/SeasonSelector";
import { StandingsCard } from "@/components/league/StandingsCard";
import { StandingsTabs } from "@/components/league/StandingsTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { PositionDelta } from "@/components/ui/PositionDelta";
import { cacheTag } from "@/lib/cache/tags";
import { formatRaceDateTimeSAST } from "@/lib/format-date";
import { formatGap } from "@/lib/format-gap";
import { pageTitle } from "@/lib/public/page-title";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { resolveLeagueSeasons, type LeagueSeason } from "@/lib/public/resolve-league-seasons";
import { loadRoundSummary } from "@/lib/public/round-summary";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  return { title: pageTitle(league ? `Standings — ${league.name}` : "Standings") };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getOverviewData(leagueId: string, seasonId: string, fallbackSeason: LeagueSeason | null) {
  const db = createSupabaseServiceRoleClient();
  const [{ data: drivers }, { data: teams }, seasons, round] = await Promise.all([
    db
      .from("driver_standings")
      .select(
        "position, previous_position, total_points, updated_at, drivers(id, display_name), teams(id, name, color_hex)",
      )
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position")
      .limit(50),
    db
      .from("team_standings")
      .select("position, previous_position, total_points, teams(id, name, color_hex)")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("position")
      .limit(15),
    resolveLeagueSeasons(leagueId, { fallbackSeason }),
    loadRoundSummary(leagueId, seasonId),
  ]);
  // Maps don't survive unstable_cache's JSON round-trip; send entries.
  const summary = round.summary
    ? {
        ...round.summary,
        driverRoundPoints: [...round.summary.driverRoundPoints],
        teamRoundPoints: [...round.summary.teamRoundPoints],
      }
    : null;
  return { drivers: drivers ?? [], nextSession: round.nextSession, seasons, summary, teams: teams ?? [] };
}

type DriverRow = { id: string; display_name: string };
type TeamRow = { id: string; name: string; color_hex: string };

const podiumText = ["text-podium-gold", "text-podium-silver", "text-podium-bronze"];
const posClass = (p: number) => podiumText[p - 1] ?? "text-f1-silver";

function RoundPts({ value }: { value: number }) {
  return (
    <span className={value > 0 ? "text-team-sauber" : "text-f1-mid"}>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

function TeamBar({ color }: { color?: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-[15px] w-1 shrink-0 ring-1 ring-white/25"
      style={{ backgroundColor: color ?? "#444" }}
    />
  );
}

export default async function StandingsOverviewPage({
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

  const rawSeason = typeof sp.season === "string" ? sp.season : null;
  const seasonId = rawSeason && UUID_RE.test(rawSeason) ? rawSeason : league.season?.id;
  if (!seasonId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState message="This league doesn't have an active season yet. Check back soon." title="No season yet" />
      </div>
    );
  }

  const { drivers, nextSession, seasons, summary, teams } = await unstable_cache(
    getOverviewData,
    ["standings-overview"],
    { revalidate: 300, tags: [cacheTag.standings(league.id)] },
  )(league.id, seasonId, league.season);

  const driverPts = new Map(summary?.driverRoundPoints ?? []);
  const teamPts = new Map(summary?.teamRoundPoints ?? []);
  const leaderPoints = drivers[0]?.total_points ?? 0;
  const displaySeason = seasons.find((s) => s.id === seasonId)?.name ?? league.season?.name ?? "";
  const siteLabel = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const th = "py-2 text-[10px] font-bold uppercase tracking-wider text-f1-muted";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <StandingsTabs active="overview" seasonId={seasonId} slug={slug} />
      <SeasonSelector currentSeasonId={seasonId} pathname={`/leagues/${slug}/standings`} seasons={seasons} />

      {drivers.length === 0 ? (
        <EmptyState message="Standings will appear once results are published." title="No standings yet" />
      ) : (
        <StandingsCard
          footerNote="Ties broken by wins, then podiums. +Rnd = points scored in the latest round."
          lastRound={summary ? `Round ${summary.roundNumber} · ${summary.roundName}` : null}
          leagueName={league.name}
          seasonName={displaySeason}
          siteLabel={siteLabel}
          title="Championship Standings"
          updatedAt={drivers[0]?.updated_at ?? null}
        >
          {summary?.podium.length || nextSession ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-f1-border bg-black/25 px-4 py-2 text-[13px]">
              {summary?.podium.map((p) => (
                <span key={p.position} className="font-semibold text-f1-white">
                  <b className={`mr-1.5 font-mono ${posClass(p.position)}`}>P{p.position}</b>
                  {p.driverName}
                </span>
              ))}
              {nextSession ? (
                <span className="ml-auto text-xs text-f1-muted">
                  Next: {nextSession.circuit ?? "TBC"} · {formatRaceDateTimeSAST(nextSession.scheduled_at)}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="grid md:grid-cols-[3fr_2fr] md:divide-x md:divide-f1-border">
            <table className="w-full">
              <caption className="px-3 pt-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-f1-muted">
                Drivers
              </caption>
              <thead>
                <tr className="border-b border-f1-border">
                  <th className={`${th} w-10 text-center`} scope="col">Pos</th>
                  <th aria-label="Change" className="w-4" scope="col" />
                  <th className={`${th} pl-1 text-left`} scope="col">Driver</th>
                  <th className={`${th} w-12 text-right`} scope="col">+Rnd</th>
                  <th className={`${th} w-12 text-right`} scope="col">Pts</th>
                  <th className={`${th} w-20 pr-3 text-right`} scope="col">Gap</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((row) => {
                  const d = row.drivers as unknown as DriverRow | null;
                  const t = row.teams as unknown as TeamRow | null;
                  return (
                    <tr key={row.position} className="h-[29px] border-b border-f1-border/50 even:bg-white/[0.018]">
                      <td className={`text-center font-mono text-[14px] font-bold ${posClass(row.position)}`}>
                        {row.position}
                      </td>
                      <td>
                        <PositionDelta compact current={row.position} previous={row.previous_position} />
                      </td>
                      <td className="max-w-0 pl-1">
                        <div className="flex items-center gap-2">
                          <TeamBar color={t?.color_hex} />
                          {d ? (
                            <Link
                              className="truncate text-[13.5px] font-bold text-f1-white hover:text-f1-red-text"
                              href={`/leagues/${slug}/drivers/${d.id}`}
                            >
                              {d.display_name}
                            </Link>
                          ) : (
                            <span className="text-[13.5px] font-bold text-f1-white">TBD</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right font-mono text-xs">
                        <RoundPts value={d ? (driverPts.get(d.id) ?? 0) : 0} />
                      </td>
                      <td className="text-right font-mono text-[15px] font-bold text-f1-white">{row.total_points}</td>
                      <td
                        className={`pr-3 text-right font-mono text-xs ${
                          row.position === 1 ? "font-bold text-podium-gold" : "text-f1-silver"
                        }`}
                      >
                        {formatGap(leaderPoints, row.total_points, row.position)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <table className="w-full self-start border-t border-f1-border md:border-t-0">
              <caption className="px-3 pt-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-f1-muted">
                Constructors
              </caption>
              <thead>
                <tr className="border-b border-f1-border">
                  <th className={`${th} w-10 text-center`} scope="col">Pos</th>
                  <th aria-label="Change" className="w-4" scope="col" />
                  <th className={`${th} pl-1 text-left`} scope="col">Team</th>
                  <th className={`${th} w-12 text-right`} scope="col">+Rnd</th>
                  <th className={`${th} w-14 pr-3 text-right`} scope="col">Pts</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((row) => {
                  const t = row.teams as unknown as TeamRow | null;
                  return (
                    <tr key={row.position} className="h-[29px] border-b border-f1-border/50 even:bg-white/[0.018]">
                      <td className={`text-center font-mono text-[14px] font-bold ${posClass(row.position)}`}>
                        {row.position}
                      </td>
                      <td>
                        <PositionDelta compact current={row.position} previous={row.previous_position} />
                      </td>
                      <td className="max-w-0 pl-1">
                        <div className="flex items-center gap-2">
                          <TeamBar color={t?.color_hex} />
                          {t ? (
                            <Link
                              className="truncate text-[13.5px] font-bold text-f1-white hover:text-f1-red-text"
                              href={`/leagues/${slug}/teams/${t.id}`}
                            >
                              {t.name}
                            </Link>
                          ) : (
                            <span className="text-[13.5px] font-bold text-f1-white">TBD</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right font-mono text-xs">
                        <RoundPts value={t ? (teamPts.get(t.id) ?? 0) : 0} />
                      </td>
                      <td className="pr-3 text-right font-mono text-[15px] font-bold text-f1-white">
                        {row.total_points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </StandingsCard>
      )}
    </div>
  );
}
