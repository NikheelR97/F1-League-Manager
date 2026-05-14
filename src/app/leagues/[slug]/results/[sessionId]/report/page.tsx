import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { comparePublicRaceResults } from "@/lib/public/result-sort";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export default async function RaceReportPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const [
    { data: session },
    { data: qualifying },
    { data: raceResults },
    // HANDOVER: never expose steward_notes or appeal_notes publicly
    { data: penalties },
  ] = await Promise.all([
    db
      .from("race_sessions")
      .select(
        "id, name, race_number, race_length_percent, published_at, circuits(name, country, grand_prix_name)",
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
    db
      .from("race_results")
      .select(
        "id, finishing_position, result_status, fastest_lap, points_awarded, penalty_points, manual_points_adjustment, drivers(display_name, racing_number), teams(name, color_hex)",
      )
      .eq("race_session_id", sessionId)
      .limit(20),
    db
      .from("penalties")
      .select("id, penalty_points, reason, status, drivers(display_name)")
      .eq("race_session_id", sessionId)
      .order("penalty_points", { ascending: false })
      .limit(20),
  ]);

  if (!session) notFound();

  type Circuit = { name: string; country: string; grand_prix_name: string };
  type Driver = { display_name: string; racing_number: number | null };
  type Team = { name: string; color_hex: string };

  const circuit = session.circuits as unknown as Circuit | null;
  const sortedResults = [...(raceResults ?? [])].sort(comparePublicRaceResults);

  const winner = sortedResults.find(
    (r) => r.result_status === "classified" && r.finishing_position === 1,
  );
  const fastestLapRow = sortedResults.find((r) => r.fastest_lap);
  const poleRow = qualifying?.find((q) => q.is_pole);

  const backHref = `/leagues/${slug}/results/${sessionId}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={session.name}
        leagueName={league.name}
        seasonName={league.season.name}
        title={`${circuit?.grand_prix_name ?? session.name} — Report`}
        updatedAt={session.published_at}
      />

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-f1-muted">
        {circuit?.country && <span>{circuit.country}</span>}
        {session.race_number === 2 && (
          <span className="rounded border border-f1-border px-1.5 py-0.5 uppercase">
            Sprint
          </span>
        )}
        <span>{session.race_length_percent}% distance</span>
        <Link
          className="ml-auto text-f1-muted underline underline-offset-2 hover:text-f1-white"
          href={backHref}
        >
          ← Full result
        </Link>
      </div>

      {/* Race highlights */}
      {(winner ?? fastestLapRow ?? poleRow) && (
        <section
          aria-label="Race highlights"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {winner && (
            <div className="border border-f1-border bg-f1-dark p-4">
              <p className="mb-1 text-xs font-bold uppercase text-f1-muted">
                Race Winner
              </p>
              <p className="font-bold text-f1-white">
                {(winner.drivers as unknown as Driver | null)?.display_name ?? "—"}
              </p>
              <p className="text-xs text-f1-muted">
                {(winner.teams as unknown as Team | null)?.name ?? "—"}
              </p>
            </div>
          )}
          {poleRow && (
            <div className="border border-f1-border bg-f1-dark p-4">
              <p className="mb-1 text-xs font-bold uppercase text-f1-muted">
                Pole Position
              </p>
              <p className="font-bold text-f1-white">
                {(poleRow.drivers as unknown as Driver | null)?.display_name ?? "—"}
              </p>
              <p className="text-xs text-f1-muted">
                {(poleRow.teams as unknown as Team | null)?.name ?? "—"}
              </p>
            </div>
          )}
          {fastestLapRow && (
            <div className="border border-f1-border bg-f1-dark p-4">
              <p className="mb-1 text-xs font-bold uppercase text-team-mclaren">
                Fastest Lap
              </p>
              <p className="font-bold text-f1-white">
                {(fastestLapRow.drivers as unknown as Driver | null)?.display_name ??
                  "—"}
              </p>
              <p className="text-xs text-f1-muted">
                {(fastestLapRow.teams as unknown as Team | null)?.name ?? "—"}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Race classification */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase text-f1-muted">
          Race Classification
        </h2>
        {sortedResults.length === 0 ? (
          <EmptyState
            message="Race classification not yet available."
            title="No result"
          />
        ) : (
          <>
            {/* Desktop table */}
            <table
              aria-label="Race classification"
              className="hidden w-full text-sm md:table"
            >
              <thead>
                <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                  <th className="w-12 pb-3 pr-4">Pos</th>
                  <th className="pb-3 pr-4">Driver</th>
                  <th className="pb-3 pr-6">Team</th>
                  <th className="pb-3 pr-4 text-right">Pts</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r) => {
                  const driver = r.drivers as unknown as Driver | null;
                  const team = r.teams as unknown as Team | null;
                  const isClassified = r.result_status === "classified";
                  const totalPts =
                    r.points_awarded + r.manual_points_adjustment;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-f1-border/40 hover:bg-f1-dark"
                    >
                      <td className="py-2 pr-4 font-mono font-bold text-f1-white">
                        {isClassified ? r.finishing_position : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`font-bold ${isClassified ? "text-f1-white" : "text-f1-muted"}`}
                        >
                          {driver?.display_name ?? "—"}
                        </span>
                        {r.fastest_lap && (
                          <span className="ml-2 text-xs font-bold text-team-mclaren">
                            FL
                          </span>
                        )}
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
                      <td className="py-2 pr-4 text-right font-mono text-f1-white">
                        {totalPts}
                      </td>
                      <td className="py-2 text-right font-mono text-xs uppercase text-f1-muted">
                        {isClassified ? "" : r.result_status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile list */}
            <ul
              aria-label="Race classification"
              className="space-y-1 md:hidden"
            >
              {sortedResults.map((r) => {
                const driver = r.drivers as unknown as Driver | null;
                const team = r.teams as unknown as Team | null;
                const isClassified = r.result_status === "classified";
                const totalPts =
                  r.points_awarded + r.manual_points_adjustment;
                return (
                  <li
                    key={r.id}
                    className="border border-f1-border/40 bg-f1-dark px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono font-bold text-f1-white">
                        {isClassified ? r.finishing_position : "—"}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-3 w-1 flex-shrink-0"
                        style={{ backgroundColor: team?.color_hex ?? "#444" }}
                      />
                      <span
                        className={`flex-1 text-sm font-bold ${isClassified ? "text-f1-white" : "text-f1-muted"}`}
                      >
                        {driver?.display_name ?? "—"}
                        {r.fastest_lap && (
                          <span className="ml-1 text-xs text-team-mclaren">
                            FL
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-sm font-bold text-f1-white">
                        {totalPts} pts
                      </span>
                      {!isClassified && (
                        <span className="font-mono text-xs uppercase text-f1-muted">
                          {r.result_status}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Qualifying order */}
      {qualifying && qualifying.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase text-f1-muted">
              Qualifying Order
            </h2>
            <Link
              className="text-xs text-f1-muted underline underline-offset-2 hover:text-f1-white"
              href={`/leagues/${slug}/results/${sessionId}/qualifying`}
            >
              Full qualifying →
            </Link>
          </div>
          <ol
            aria-label="Qualifying order"
            className="grid grid-cols-2 gap-1 sm:grid-cols-4"
          >
            {qualifying.map((q) => {
              const driver = q.drivers as unknown as Driver | null;
              const team = q.teams as unknown as Team | null;
              return (
                <li
                  key={q.qualifying_position}
                  className="flex items-center gap-2 border border-f1-border/40 bg-f1-dark px-2.5 py-1.5 text-xs"
                >
                  <span
                    className={`w-4 font-mono font-bold ${q.is_pole ? "text-f1-red" : "text-f1-muted"}`}
                  >
                    {q.qualifying_position}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-3 w-0.5 flex-shrink-0"
                    style={{ backgroundColor: team?.color_hex ?? "#444" }}
                  />
                  <span className="truncate text-f1-white">
                    {driver?.display_name ?? "—"}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Penalties — steward_notes and appeal_notes intentionally excluded */}
      {penalties && penalties.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase text-f1-muted">
            Penalties
          </h2>
          <ul className="space-y-1">
            {penalties.map((p) => {
              const driver = p.drivers as unknown as {
                display_name: string;
              } | null;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-4 py-2 text-sm"
                >
                  <div>
                    <span className="text-f1-white">
                      {driver?.display_name ?? "—"}
                    </span>
                    {p.reason && (
                      <span className="ml-3 text-xs text-f1-muted">
                        {p.reason}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs text-f1-red">
                      {p.penalty_points} pts
                    </span>
                    <span className="ml-3 font-mono text-xs uppercase text-f1-muted">
                      {p.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
