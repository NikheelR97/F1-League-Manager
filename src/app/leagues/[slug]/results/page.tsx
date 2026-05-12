import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { SeasonSelector } from "@/components/league/SeasonSelector";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { resolveLeagueSeasons } from "@/lib/public/resolve-league-seasons";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    rawSeason && UUID_RE.test(rawSeason) ? rawSeason : league.season.id;

  const db = createSupabaseServiceRoleClient();

  const [{ data: sessions }, seasons] = await Promise.all([
    db
      .from("race_sessions")
      .select(
        "id, name, race_number, race_length_percent, scheduled_at, published_at, circuits(name, country, grand_prix_name)",
      )
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(50),
    resolveLeagueSeasons(league.id),
  ]);

  const results = sessions ?? [];
  const lastSession = results[0];
  const displaySeason =
    seasons.find((s) => s.id === seasonId)?.name ?? league.season.name;

  type Circuit = { name: string; country: string; grand_prix_name: string };

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
          {results.map((session) => {
            const circuit = session.circuits as unknown as Circuit | null;
            return (
              <li key={session.id}>
                <Link
                  className="flex items-center justify-between border border-f1-border bg-f1-dark p-4 transition-colors hover:border-f1-red"
                  href={`/leagues/${league.slug}/results/${session.id}`}
                >
                  <div>
                    <p className="font-bold text-f1-white">
                      {circuit?.grand_prix_name ?? session.name}
                    </p>
                    <p className="text-xs text-f1-muted">
                      {circuit?.country ?? ""}
                      {session.race_number === 2 ? " · Race 2" : ""}
                      {" · "}
                      {session.race_length_percent}% distance
                    </p>
                  </div>
                  <div className="text-right">
                    {session.published_at && (
                      <p className="text-xs text-f1-muted">
                        {new Date(session.published_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    <p className="text-xs text-f1-red">View →</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
