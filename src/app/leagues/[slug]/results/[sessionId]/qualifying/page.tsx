import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export default async function QualifyingResultsPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const [{ data: session }, { data: qualifying }] = await Promise.all([
    db
      .from("race_sessions")
      .select(
        "id, name, published_at, circuits(name, country, grand_prix_name)",
      )
      .eq("id", sessionId)
      .eq("league_id", league.id)
      .eq("status", "completed")
      .single(),
    db
      .from("qualifying_results")
      .select(
        "qualifying_position, is_pole, drivers(display_name, racing_number), teams(name, color_hex)",
      )
      .eq("race_session_id", sessionId)
      .order("qualifying_position")
      .limit(20),
  ]);

  if (!session) notFound();

  type Circuit = { name: string; country: string; grand_prix_name: string };
  type Driver = { display_name: string; racing_number: number | null };
  type Team = { name: string; color_hex: string };

  const circuit = session.circuits as unknown as Circuit | null;
  const backHref = `/leagues/${slug}/results/${sessionId}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={session.name}
        leagueName={league.name}
        seasonName={league.season.name}
        title={`${circuit?.grand_prix_name ?? session.name} — Qualifying`}
        updatedAt={session.published_at}
      />

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-f1-muted">
        {circuit?.country && <span>{circuit.country}</span>}
        <Link
          className="ml-auto text-f1-muted underline underline-offset-2 hover:text-f1-white"
          href={backHref}
        >
          ← Full result
        </Link>
      </div>

      {/* Qualifying classification */}
      {!qualifying || qualifying.length === 0 ? (
        <EmptyState
          message="Qualifying results have not been published for this session."
          title="No qualifying data"
        />
      ) : (
        <>
          {/* Desktop table */}
          <table
            aria-label="Qualifying classification"
            className="hidden w-full text-sm md:table"
          >
            <thead>
              <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                <th className="w-12 pb-3 pr-4">Pos</th>
                <th className="pb-3 pr-4">Driver</th>
                <th className="pb-3 pr-6">Team</th>
                <th className="pb-3 text-right">No.</th>
              </tr>
            </thead>
            <tbody>
              {qualifying.map((q) => {
                const driver = q.drivers as unknown as Driver | null;
                const team = q.teams as unknown as Team | null;
                const isPole = q.is_pole;
                return (
                  <tr
                    key={q.qualifying_position}
                    className={`border-b border-f1-border/40 ${isPole ? "bg-f1-dark" : ""}`}
                  >
                    <td className="py-2 pr-4">
                      <span
                        className={`font-mono font-bold ${isPole ? "text-f1-red" : "text-f1-white"}`}
                      >
                        {q.qualifying_position}
                      </span>
                      {isPole && (
                        <span className="ml-2 text-xs font-bold uppercase text-f1-red">
                          P
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-bold text-f1-white">
                      {driver?.display_name ?? "—"}
                    </td>
                    <td className="py-2 pr-6">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-1 flex-shrink-0"
                          style={{ backgroundColor: team?.color_hex ?? "#444" }}
                        />
                        <span className="text-f1-muted">{team?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono text-f1-muted">
                      {driver?.racing_number ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile list */}
          <ul aria-label="Qualifying classification" className="space-y-1 md:hidden">
            {qualifying.map((q) => {
              const driver = q.drivers as unknown as Driver | null;
              const team = q.teams as unknown as Team | null;
              const isPole = q.is_pole;
              return (
                <li
                  key={q.qualifying_position}
                  className={`flex items-center gap-3 border border-f1-border/40 px-3 py-2.5 text-sm ${isPole ? "bg-f1-dark" : ""}`}
                >
                  <span
                    className={`w-7 font-mono font-bold ${isPole ? "text-f1-red" : "text-f1-white"}`}
                  >
                    {q.qualifying_position}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-3 w-1 flex-shrink-0"
                    style={{ backgroundColor: team?.color_hex ?? "#444" }}
                  />
                  <span className="flex-1 font-bold text-f1-white">
                    {driver?.display_name ?? "—"}
                  </span>
                  <span className="text-xs text-f1-muted">{team?.name ?? "—"}</span>
                  {isPole && (
                    <span className="text-xs font-bold uppercase text-f1-red">
                      Pole
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
