import "server-only";

import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// HANDOVER sort order: finished → lap down → dnf → dsq → ban → dnp
const STATUS_SORT: Record<string, number> = {
  classified: 0,
  dnf: 1,
  dns: 2,
  dsq: 3,
  ban: 4,
};

export default async function RaceResultPage({
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
    { data: penalties },
  ] = await Promise.all([
    db
      .from("race_sessions")
      .select("id, name, race_number, race_length_percent, published_at, circuits(name, country, grand_prix_name)")
      .eq("id", sessionId)
      .eq("league_id", league.id)
      .eq("status", "completed")
      .single(),
    db
      .from("qualifying_results")
      .select("qualifying_position, is_pole, drivers(display_name, racing_number), teams(name, color_hex)")
      .eq("race_session_id", sessionId)
      .order("qualifying_position")
      .limit(20),
    db
      .from("race_results")
      .select(
        "id, finishing_position, result_status, fastest_lap, points_awarded, penalty_points, manual_points_adjustment, raw_result, drivers(id, display_name, racing_number), teams(name, color_hex)",
      )
      .eq("race_session_id", sessionId)
      .limit(20),
    // HANDOVER: never expose steward_notes or appeal_notes publicly
    db
      .from("penalties")
      .select("id, penalty_points, reason, status, drivers(display_name)")
      .eq("race_session_id", sessionId)
      .order("penalty_points", { ascending: false })
      .limit(20),
  ]);

  if (!session) notFound();

  type Circuit = { name: string; country: string; grand_prix_name: string };
  type Driver = { id: string; display_name: string; racing_number: number | null };
  type Team = { name: string; color_hex: string };

  const circuit = session.circuits as unknown as Circuit | null;

  const sortedResults = [...(raceResults ?? [])].sort((a, b) => {
    const aStatus = STATUS_SORT[a.result_status] ?? 0;
    const bStatus = STATUS_SORT[b.result_status] ?? 0;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return (a.finishing_position ?? 99) - (b.finishing_position ?? 99);
  });

  const fastestLapRow = sortedResults.find((r) => r.fastest_lap);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={session.name}
        leagueName={league.name}
        seasonName={league.season.name}
        title={circuit?.grand_prix_name ?? session.name}
        updatedAt={session.published_at}
      />

      {/* Session meta */}
      <div className="flex flex-wrap gap-4 text-xs text-f1-muted">
        {circuit?.country && <span>{circuit.country}</span>}
        {session.race_number === 2 && <span>Race 2</span>}
        <span>{session.race_length_percent}% distance</span>
        {fastestLapRow && (
          <span className="text-team-mclaren">
            FL: {(fastestLapRow.drivers as unknown as Driver | null)?.display_name ?? "—"}
          </span>
        )}
      </div>

      {/* Qualifying */}
      {qualifying && qualifying.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase text-f1-muted">Qualifying</h2>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                <th className="pb-2 pr-4 w-10">Pos</th>
                <th className="pb-2 pr-4">Driver</th>
                <th className="pb-2">Team</th>
              </tr>
            </thead>
            <tbody>
              {qualifying.map((q) => {
                const driver = q.drivers as unknown as Driver | null;
                const team = q.teams as unknown as Team | null;
                return (
                  <tr key={q.qualifying_position} className="border-b border-f1-border/40">
                    <td className="py-1.5 pr-4 font-mono font-bold text-f1-white">
                      {q.qualifying_position}{q.is_pole ? " 🏁" : ""}
                    </td>
                    <td className="py-1.5 pr-4 text-f1-white">{driver?.display_name ?? "—"}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="h-3 w-1" style={{ backgroundColor: team?.color_hex ?? "#444" }} />
                        <span className="text-f1-muted">{team?.name ?? "—"}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Mobile */}
          <ul className="space-y-1 md:hidden">
            {qualifying.map((q) => {
              const driver = q.drivers as unknown as Driver | null;
              const team = q.teams as unknown as Team | null;
              return (
                <li key={q.qualifying_position} className="flex items-center gap-3 border border-f1-border/40 bg-f1-dark px-3 py-2 text-sm">
                  <span className="w-6 font-mono font-bold text-f1-white">{q.qualifying_position}</span>
                  <span aria-hidden="true" className="h-3 w-1" style={{ backgroundColor: team?.color_hex ?? "#444" }} />
                  <span className="text-f1-white">{driver?.display_name ?? "—"}</span>
                  <span className="ml-auto text-xs text-f1-muted">{team?.name ?? "—"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Race result */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase text-f1-muted">Race Result</h2>
        {sortedResults.length === 0 ? (
          <EmptyState message="Race result not yet available." title="No result" />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                  <th className="pb-2 pr-4 w-10">Pos</th>
                  <th className="pb-2 pr-4">Driver</th>
                  <th className="pb-2 pr-4">Team</th>
                  <th className="pb-2 pr-4 text-right">Pts</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r) => {
                  const driver = r.drivers as unknown as Driver | null;
                  const team = r.teams as unknown as Team | null;
                  const isClassified = r.result_status === "classified";
                  const totalPts = r.points_awarded + r.manual_points_adjustment;
                  return (
                    <tr key={r.id} className="border-b border-f1-border/40 hover:bg-f1-dark">
                      <td className="py-2 pr-4 font-mono font-bold text-f1-white">
                        {isClassified ? r.finishing_position : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`font-bold ${isClassified ? "text-f1-white" : "text-f1-muted"}`}>
                          {driver?.display_name ?? "—"}
                        </span>
                        {r.fastest_lap && (
                          <span className="ml-2 text-xs font-bold text-team-mclaren">FL</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-3 w-1" style={{ backgroundColor: team?.color_hex ?? "#444" }} />
                          <span className="text-f1-muted">{team?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-f1-white">{totalPts}</td>
                      <td className="py-2 text-right font-mono text-xs uppercase text-f1-muted">
                        {isClassified ? "" : r.result_status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Mobile */}
            <ul className="space-y-1 md:hidden">
              {sortedResults.map((r) => {
                const driver = r.drivers as unknown as Driver | null;
                const team = r.teams as unknown as Team | null;
                const isClassified = r.result_status === "classified";
                const totalPts = r.points_awarded + r.manual_points_adjustment;
                return (
                  <li key={r.id} className="border border-f1-border/40 bg-f1-dark px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono font-bold text-f1-white">
                        {isClassified ? r.finishing_position : "—"}
                      </span>
                      <span aria-hidden="true" className="h-3 w-1" style={{ backgroundColor: team?.color_hex ?? "#444" }} />
                      <span className={`flex-1 text-sm ${isClassified ? "text-f1-white" : "text-f1-muted"}`}>
                        {driver?.display_name ?? "—"}
                        {r.fastest_lap && <span className="ml-1 text-xs text-team-mclaren">FL</span>}
                      </span>
                      <span className="font-mono text-sm font-bold text-f1-white">{totalPts} pts</span>
                      {!isClassified && (
                        <span className="font-mono text-xs uppercase text-f1-muted">{r.result_status}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Race penalties — steward_notes and appeal_notes intentionally excluded */}
      {penalties && penalties.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase text-f1-muted">Penalties</h2>
          <ul className="space-y-1">
            {penalties.map((p) => {
              const driver = p.drivers as unknown as { display_name: string } | null;
              return (
                <li key={p.id} className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-4 py-2 text-sm">
                  <span className="text-f1-white">{driver?.display_name ?? "—"}</span>
                  <div className="text-right">
                    <span className="font-mono text-xs text-f1-red">{p.penalty_points} pts</span>
                    <span className="ml-3 font-mono text-xs uppercase text-f1-muted">{p.status}</span>
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
