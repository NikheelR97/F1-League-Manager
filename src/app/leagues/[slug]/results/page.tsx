import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { SeasonSelector } from "@/components/league/SeasonSelector";
import { formatDate } from "@/lib/format-date";
import { groupRounds } from "@/lib/public/group-rounds";
import { leagueRoundNumbers } from "@/lib/public/league-round-number";
import { pageTitle } from "@/lib/public/page-title";
import { roundPrefix } from "@/lib/public/round-prefix";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { resolveLeagueSeasons } from "@/lib/public/resolve-league-seasons";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  return { title: pageTitle(league ? `Results — ${league.name}` : "Results") };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PodiumRow = { pos: number; name: string; color: string };
const POS_COLOR = ["", "text-podium-gold", "text-podium-silver", "text-podium-bronze"];

function Podium({ rows, compact }: { rows?: PodiumRow[]; compact?: boolean }) {
  if (!rows?.length) return compact ? null : <p className="mt-3 text-xs text-f1-muted">Result not recorded</p>;
  const [first, ...rest] = rows;
  const chip = (r: PodiumRow, cls: string) => (
    <span key={r.pos} className={`inline-flex items-center gap-1.5 ${cls}`}>
      <span className={`font-mono font-bold ${POS_COLOR[r.pos]}`}>P{r.pos}</span>
      <span aria-hidden="true" className="h-3 w-1" style={{ backgroundColor: r.color }} />
      <span>{r.name}</span>
    </span>
  );
  return (
    <div className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 ${compact ? "mt-1 text-xs text-f1-muted" : "mt-3"}`}>
      {chip(first, compact ? "" : "text-lg font-bold text-f1-white")}
      {rest.map((r) => chip(r, compact ? "" : "text-sm text-f1-muted"))}
    </div>
  );
}

export default async function ResultsIndexPage({
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

  const db = createSupabaseServiceRoleClient();

  const [{ data: sessions }, seasons] = await Promise.all([
    db
      .from("race_sessions")
      .select(
        "id, name, race_number, race_length_percent, scheduled_at, published_at, circuits(name, country, grand_prix_name, round_number)",
      )
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false })
      // Sprint + feature share a start time; the feature (race_number 1) runs last.
      .order("race_number", { ascending: true })
      .limit(200),
    resolveLeagueSeasons(league.id, { fallbackSeason: league.season }),
  ]);

  const results = sessions ?? [];
  const { data: podiumRows } = results.length
    ? await db
        .from("race_results")
        .select("race_session_id, finishing_position, drivers(display_name), teams(color_hex)")
        .in("race_session_id", results.map((r) => r.id))
        .eq("result_status", "classified")
        .lte("finishing_position", 3)
        .order("finishing_position")
    : { data: [] };
  const podiums = new Map<string, PodiumRow[]>();
  for (const r of podiumRows ?? []) {
    podiums.set(r.race_session_id, [
      ...(podiums.get(r.race_session_id) ?? []),
      {
        pos: r.finishing_position as number,
        name: (r.drivers as unknown as { display_name: string } | null)?.display_name ?? "—",
        color: (r.teams as unknown as { color_hex: string } | null)?.color_hex ?? "#444",
      },
    ]);
  }
  const lastSession = results[0];
  const roundNumbers = leagueRoundNumbers(results);
  const displaySeason =
    seasons.find((s) => s.id === seasonId)?.name ?? league.season?.name ?? "";

  type Circuit = { name: string; country: string; grand_prix_name: string; round_number: number | null };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={displaySeason}
        title="Race Results"
        updatedAt={lastSession?.published_at ?? null}
      />

      <SeasonSelector
        currentSeasonId={seasonId}
        pathname={`/leagues/${slug}/results`}
        seasons={seasons}
      />

      {results.length === 0 ? (
        <EmptyState message="Results will appear once races are published." title="No results yet" />
      ) : (
        <ul className="space-y-2">
          {groupRounds(results, roundNumbers).map(({ round, main, extras }) => {
            const circuit = main.circuits as unknown as Circuit | null;
            const displayName = circuit?.grand_prix_name ?? main.name;
            const date = main.scheduled_at ?? main.published_at;
            return (
              <li key={main.id} className="border border-f1-border bg-f1-dark">
                <Link
                  className="block p-4 transition-colors hover:bg-black/20"
                  href={`/leagues/${league.slug}/results/${main.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-f1-white">
                        {roundPrefix(round, displayName)}
                        {displayName}
                      </p>
                      <p className="text-xs text-f1-muted">
                        {circuit?.country ?? ""}
                        {" · "}
                        {main.race_length_percent}% distance
                      </p>
                    </div>
                    {date && <p className="shrink-0 text-xs text-f1-muted">{formatDate(date)}</p>}
                  </div>
                  <Podium rows={podiums.get(main.id)} />
                </Link>
                {extras.map((x) => (
                  <Link
                    key={x.id}
                    className="block border-t border-f1-border px-4 py-2 transition-colors hover:bg-black/20"
                    href={`/leagues/${league.slug}/results/${x.id}`}
                  >
                    <span className="text-xs font-bold uppercase text-f1-muted">Sprint</span>
                    <Podium compact rows={podiums.get(x.id)} />
                  </Link>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
