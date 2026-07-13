import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ResultStatus } from "@/components/ui/ResultStatus";
import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { leagueRoundNumbers } from "@/lib/public/league-round-number";
import { pageTitle } from "@/lib/public/page-title";
import { comparePublicRaceResults } from "@/lib/public/result-sort";
import { roundPrefix } from "@/lib/public/round-prefix";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// ponytail: this refetches session/circuit name (not cache()-wrapped like
// resolvePublicLeague) so it runs once more than the page body — a single
// indexed .single() lookup on race_sessions.id, cheap enough not to bother
// wiring a shared cache for a tab title.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}): Promise<Metadata> {
  const { slug, sessionId } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) return { title: pageTitle("Race Result") };

  const db = createSupabaseServiceRoleClient();
  const { data: session } = await db
    .from("race_sessions")
    .select("name, season_id, circuits(grand_prix_name, round_number)")
    .eq("id", sessionId)
    .eq("league_id", league.id)
    .single();

  const circuit = session?.circuits as unknown as { grand_prix_name: string; round_number: number | null } | null;
  const displayName = circuit?.grand_prix_name ?? session?.name ?? "Race Result";

  const { data: siblings } = session
    ? await db
        .from("race_sessions")
        .select("id, scheduled_at")
        .eq("league_id", league.id)
        .eq("season_id", session.season_id)
        .eq("status", "completed")
    : { data: null };
  const roundNumber = siblings ? leagueRoundNumbers(siblings).get(sessionId) : undefined;

  return { title: pageTitle(`${roundPrefix(roundNumber, displayName)}${displayName}`) };
}

// HANDOVER sort order: finished → lap down → dnf → dsq → ban → dnp
export default async function RaceResultPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  if (!league.season) {
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

  const [
    { data: session },
    { data: qualifying },
    { data: raceResults },
    { data: penalties },
  ] = await Promise.all([
    db
      .from("race_sessions")
      .select("id, name, season_id, race_number, race_length_percent, published_at, circuits(name, country, grand_prix_name, round_number)")
      .eq("id", sessionId)
      .eq("league_id", league.id)
      .eq("status", "completed")
      .single(),
    db
      .from("qualifying_results")
      .select("driver_id, qualifying_position, qualifying_status, is_pole, drivers(display_name, racing_number), teams(name, color_hex)")
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

  type Circuit = { name: string; country: string; grand_prix_name: string; round_number: number | null };
  type Driver = { id: string; display_name: string; racing_number: number | null };
  type Team = { name: string; color_hex: string };

  const circuit = session.circuits as unknown as Circuit | null;
  const displayName = circuit?.grand_prix_name ?? session.name;

  // League round number = this session's rank by scheduled_at among the
  // league's completed sessions this season — not circuits.round_number,
  // which is the circuit's real-world F1 calendar slot.
  const { data: siblings } = await db
    .from("race_sessions")
    .select("id, scheduled_at")
    .eq("league_id", league.id)
    .eq("season_id", session.season_id)
    .eq("status", "completed");
  const roundNumber = leagueRoundNumbers(siblings ?? []).get(session.id);

  const sortedResults = [...(raceResults ?? [])].sort(comparePublicRaceResults);

  const fastestLapRow = sortedResults.find((r) => r.fastest_lap);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={session.name}
        leagueName={league.name}
        seasonName={league.season.name}
        title={`${roundPrefix(roundNumber, displayName)}${displayName}`}
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
                <th className="pb-2 pr-4 w-10" scope="col">Pos</th>
                <th className="pb-2 pr-4" scope="col">Driver</th>
                <th className="pb-2" scope="col">Team</th>
              </tr>
            </thead>
            <tbody>
              {qualifying.map((q) => {
                const driver = q.drivers as unknown as Driver | null;
                const team = q.teams as unknown as Team | null;
                const isClassified = q.qualifying_status === "classified";
                return (
                  <tr key={q.driver_id} className="border-b border-f1-border/40">
                    <td className="py-1.5 pr-4 font-mono font-bold text-f1-white">
                      {isClassified ? (
                        <>{q.qualifying_position}{q.is_pole ? " 🏁" : ""}</>
                      ) : (
                        <ResultStatus status={q.qualifying_status} />
                      )}
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
              const isClassified = q.qualifying_status === "classified";
              return (
                <li key={q.driver_id} className="flex items-center gap-3 border border-f1-border/40 bg-f1-dark px-3 py-2 text-sm">
                  <span className="w-6 font-mono font-bold text-f1-white">
                    {isClassified ? q.qualifying_position : "—"}
                  </span>
                  <span aria-hidden="true" className="h-3 w-1" style={{ backgroundColor: team?.color_hex ?? "#444" }} />
                  <span className="text-f1-white">{driver?.display_name ?? "—"}</span>
                  {isClassified ? (
                    <span className="ml-auto text-xs text-f1-muted">{team?.name ?? "—"}</span>
                  ) : (
                    <span className="ml-auto"><ResultStatus status={q.qualifying_status} /></span>
                  )}
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
          <div className="space-y-3">
            <EmptyState
              message="Full finishing order wasn't recorded for this race. Championship points from this round are reflected in the standings."
              title="Result not recorded"
            />
            <Link
              className="inline-block text-xs font-bold uppercase text-f1-red-text underline underline-offset-2 hover:text-f1-white"
              href={`/leagues/${slug}/standings/drivers`}
            >
              View standings →
            </Link>
          </div>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                  <th className="pb-2 pr-4 w-10" scope="col">Pos</th>
                  <th className="pb-2 pr-4" scope="col">Driver</th>
                  <th className="pb-2 pr-4" scope="col">Team</th>
                  <th className="pb-2 pr-4 text-right" scope="col">Pts</th>
                  <th className="pb-2 text-right" scope="col">Status</th>
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
                          {/* M4 — team_id is null for a free-agent result: no constructor, but the driver still scored. */}
                          <span className="text-f1-muted">{team?.name ?? "Free agent"}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-f1-white">{totalPts}</td>
                      <td className="py-2 text-right">
                        <ResultStatus status={r.result_status} />
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
                        <ResultStatus status={r.result_status} />
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
