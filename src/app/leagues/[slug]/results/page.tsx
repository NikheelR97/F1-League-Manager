import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export default async function ResultsIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const { data: sessions } = await db
    .from("race_sessions")
    .select("id, name, race_number, race_length_percent, scheduled_at, published_at, circuits(name, country, grand_prix_name)")
    .eq("league_id", league.id)
    .eq("season_id", league.season.id)
    .eq("status", "completed")
    .order("published_at", { ascending: false })
    .limit(50);

  const results = sessions ?? [];
  const lastSession = results[0];

  type Circuit = { name: string; country: string; grand_prix_name: string };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={league.season.name}
        title="Race Results"
        updatedAt={lastSession?.published_at ?? null}
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
