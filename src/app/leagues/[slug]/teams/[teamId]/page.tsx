import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { formatPosition } from "@/lib/public/format-position";
import { pageTitle } from "@/lib/public/page-title";
import { comparePublicRaceResults } from "@/lib/public/result-sort";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { buildDriverPointsBreakdown } from "@/lib/results/standings";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// ponytail: this refetches the team name (not cache()-wrapped) — a single
// indexed .single() lookup by primary key, cheap enough not to bother
// wiring a shared cache for a tab title.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}): Promise<Metadata> {
  const { slug, teamId } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) return { title: pageTitle("Team") };

  const db = createSupabaseServiceRoleClient();
  const { data: team } = await db
    .from("teams")
    .select("name")
    .eq("id", teamId)
    .eq("league_id", league.id)
    .single();

  return { title: pageTitle(`${team?.name ?? "Team"} — ${league.name}`) };
}

// HANDOVER sort order: finished → lap down → dnf → dsq → ban → dnp
export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = await params;
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

  // Step 1: parallel fetches that don't depend on each other
  const [
    { data: team },
    { data: standing },
    { data: completedSessions },
    { data: lastSession },
    { data: entries },
  ] = await Promise.all([
    db
      .from("teams")
      .select("id, name, color_hex, logo_path")
      .eq("id", teamId)
      .eq("league_id", league.id)
      .single(),
    db
      .from("team_standings")
      .select("position, previous_position, total_points, wins, podiums")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("team_id", teamId)
      .maybeSingle(),
    db
      .from("race_sessions")
      .select("id")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("status", "completed")
      .limit(50),
    db
      .from("race_sessions")
      .select("name, published_at")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("league_driver_entries")
      .select("id, drivers(id, display_name, racing_number)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .limit(30),
  ]);

  if (!team) notFound();

  // Step 2: fetch active stints and race results scoped to this league's sessions
  const entryIds = (entries ?? []).map((e) => e.id);
  const sessionIds = (completedSessions ?? []).map((s) => s.id);

  const [{ data: activeStints }, { data: raceResults }, { count: poleCount }] = await Promise.all([
    // Not scoped to this team: also used to tell whether an historically-
    // attributed driver has since moved to another team (former driver) or
    // has no current stint anywhere (free agent) — see rosterNote below.
    entryIds.length > 0
      ? db
          .from("driver_team_stints")
          .select("league_driver_entry_id, team_id")
          .is("ends_on", null)
          .in("league_driver_entry_id", entryIds)
      : { data: [] },
    sessionIds.length > 0
      ? db
          .from("race_results")
          .select(
            "race_session_id, finishing_position, result_status, raw_result, fastest_lap, points_awarded, manual_points_adjustment, drivers(id, display_name), race_sessions(name, scheduled_at, circuits(name, grand_prix_name))",
          )
          .eq("team_id", teamId)
          .in("race_session_id", sessionIds)
          .order("scheduled_at", { referencedTable: "race_sessions", ascending: true })
          .limit(50)
      : { data: [] },
    sessionIds.length > 0
      ? db
          .from("qualifying_results")
          .select("id", { count: "exact" })
          .eq("team_id", teamId)
          .eq("is_pole", true)
          .in("race_session_id", sessionIds)
          .limit(50)
      : { count: 0 },
  ]);

  // Derive current drivers from active stints
  const currentTeamByEntryId = new Map((activeStints ?? []).map((s) => [s.league_driver_entry_id, s.team_id]));
  const activeEntryIds = new Set(
    [...currentTeamByEntryId.entries()].filter(([, tId]) => tId === teamId).map(([entryId]) => entryId),
  );

  type DriverEntry = { id: string; display_name: string; racing_number: number | null };
  type EntryRow = { id: string; drivers: unknown };

  const currentDrivers = (entries ?? [])
    .filter((e) => activeEntryIds.has(e.id))
    .map((e) => (e as unknown as EntryRow).drivers as DriverEntry | null)
    .filter((d): d is DriverEntry => d !== null);

  // driver_id -> league_driver_entry_id, so rosterNote can look up a driver's
  // current team regardless of which team's page this is.
  const entryIdByDriverId = new Map<string, string>();
  for (const e of entries ?? []) {
    const d = (e as unknown as EntryRow).drivers as DriverEntry | null;
    if (d) entryIdByDriverId.set(d.id, e.id);
  }

  // Points breakdown / race results below list every driver ever attributed
  // to this team (historical), not just the current roster. Label the ones
  // who aren't currently on this team so the numbers aren't mistaken for an
  // error — see UAT M3 / Cluster B.
  function rosterNote(driverId: string): "former" | "free-agent" | null {
    const entryId = entryIdByDriverId.get(driverId);
    const currentTeamId = entryId ? currentTeamByEntryId.get(entryId) : undefined;
    if (currentTeamId === teamId) return null;
    return currentTeamId ? "former" : "free-agent";
  }

  type RaceSession = { name: string; circuits: unknown };
  type Circuit = { name: string; grand_prix_name: string };
  type Driver = { id: string; display_name: string };

  const sortedResults = [...(raceResults ?? [])].sort(comparePublicRaceResults);

  // Season summary derived from the already-fetched race results — no extra queries
  const classifiedFinishes = (raceResults ?? [])
    .filter((r) => r.result_status === "classified" && r.finishing_position !== null)
    .map((r) => r.finishing_position as number);
  const bestFinish = classifiedFinishes.length > 0 ? Math.min(...classifiedFinishes) : null;
  const fastestLapCount = (raceResults ?? []).filter((r) => r.fastest_lap).length;

  // F1 — this breakdown is constructor-context, so it must reconcile with
  // the header's team_standings.total_points, which uses points_awarded
  // only (see buildDriverPointsBreakdown / buildTeamStandings in standings.ts).
  const driverBreakdown = buildDriverPointsBreakdown(
    (raceResults ?? []).flatMap((r) => {
      const driver = r.drivers as unknown as Driver | null;
      if (!driver) return [];
      return [
        {
          driver_id: driver.id,
          driver_name: driver.display_name,
          points_awarded: r.points_awarded,
          manual_points_adjustment: r.manual_points_adjustment,
        },
      ];
    }),
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={league.season.name}
        title={team.name}
        updatedAt={lastSession?.published_at ?? null}
      />

      {/* Team meta */}
      <div className="grid grid-cols-2 gap-4 border border-f1-border bg-f1-dark p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-f1-muted">Team</p>
          <div className="mt-1 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-4 w-1 shrink-0"
              style={{ backgroundColor: team.color_hex ?? "#444" }}
            />
            <p className="font-bold text-f1-white">{team.name}</p>
          </div>
        </div>
        {standing ? (
          <>
            <div>
              <p className="text-xs text-f1-muted">Championship</p>
              <p className="font-mono font-bold text-f1-white">
                P{standing.position} · {standing.total_points} pts
              </p>
            </div>
            <div>
              <p className="text-xs text-f1-muted">W / Pod</p>
              <p className="font-mono text-f1-white">
                {standing.wins} / {standing.podiums}
              </p>
            </div>
          </>
        ) : null}
        {currentDrivers.length > 0 && (
          <div>
            <p className="text-xs text-f1-muted">Current Drivers</p>
            <div className="space-y-0.5">
              {currentDrivers.map((d) => (
                <p key={d.id} className="text-f1-white">
                  {d.racing_number ? <span className="font-mono text-xs text-f1-muted">#{d.racing_number} </span> : null}
                  {d.display_name}
                </p>
              ))}
            </div>
          </div>
        )}
        {bestFinish !== null && (
          <div>
            <p className="text-xs text-f1-muted">Best Finish</p>
            <p className="font-mono font-bold text-f1-white">P{bestFinish}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-f1-muted">Poles / FL</p>
          <p className="font-mono text-f1-white">
            {poleCount ?? 0} / {fastestLapCount}
          </p>
        </div>
      </div>

      {/* Driver points breakdown */}
      {driverBreakdown.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase text-f1-muted">Driver Points Breakdown</h2>
          <ul className="grid gap-1 sm:grid-cols-2">
            {driverBreakdown.map((d) => {
              const note = rosterNote(d.driver_id);
              return (
                <li
                  key={d.driver_id}
                  className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-3 py-2 text-sm"
                >
                  <span className="text-f1-white">
                    {d.name}
                    {note && (
                      <Link
                        className="ml-2 text-xs uppercase text-f1-muted hover:text-f1-white"
                        href={`/leagues/${slug}/drivers/${d.driver_id}`}
                      >
                        {note === "former" ? "former driver" : "free agent"}
                      </Link>
                    )}
                  </span>
                  <span className="font-mono font-bold text-f1-white">{d.points} pts</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Race results */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase text-f1-muted">Race Results</h2>
        {sortedResults.length === 0 ? (
          <EmptyState message="No results published yet." title="No results" />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                  <th className="pb-2 pr-4">Race</th>
                  <th className="pb-2 pr-4">Driver</th>
                  <th className="pb-2 pr-4 text-right">Pos</th>
                  <th className="pb-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r) => {
                  const race = r.race_sessions as unknown as RaceSession | null;
                  const circuit = race?.circuits as unknown as Circuit | null;
                  const driver = r.drivers as unknown as Driver | null;
                  const totalPts = r.points_awarded;
                  const note = driver ? rosterNote(driver.id) : null;
                  return (
                    <tr key={`${r.race_session_id}-${driver?.id}`} className="border-b border-f1-border/40 hover:bg-f1-dark">
                      <td className="py-2 pr-4">
                        <div className="text-f1-white">
                          {circuit?.grand_prix_name ?? "—"}
                          {race?.name && <span className="ml-2 text-xs text-f1-muted">{race.name}</span>}
                        </div>
                        {r.fastest_lap && (
                          <span className="ml-2 text-xs font-bold text-team-mclaren">FL</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-f1-muted">
                        {driver?.display_name ?? "—"}
                        {note && driver && (
                          <Link
                            className="ml-2 text-xs uppercase text-f1-muted hover:text-f1-white"
                            href={`/leagues/${slug}/drivers/${driver.id}`}
                          >
                            {note === "former" ? "former driver" : "free agent"}
                          </Link>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs text-f1-muted">
                        {formatPosition(r.result_status, r.finishing_position)}
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-f1-white">{totalPts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="space-y-1 md:hidden">
              {sortedResults.map((r) => {
                const race = r.race_sessions as unknown as RaceSession | null;
                const circuit = race?.circuits as unknown as Circuit | null;
                const driver = r.drivers as unknown as Driver | null;
                const totalPts = r.points_awarded;
                const note = driver ? rosterNote(driver.id) : null;
                return (
                  <li
                    key={`${r.race_session_id}-${driver?.id}`}
                    className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-4 py-2 text-sm"
                  >
                    <div>
                      <div className="text-f1-white">
                        {circuit?.grand_prix_name ?? "—"}
                        {race?.name && <span className="ml-2 text-xs text-f1-muted">{race.name}</span>}
                      </div>
                      {r.fastest_lap && (
                        <span className="ml-2 text-xs font-bold text-team-mclaren">FL</span>
                      )}
                      <p className="text-xs text-f1-muted">
                        {driver?.display_name ?? "—"}
                        {note && driver && (
                          <Link
                            className="ml-2 text-xs uppercase text-f1-muted hover:text-f1-white"
                            href={`/leagues/${slug}/drivers/${driver.id}`}
                          >
                            {note === "former" ? "former driver" : "free agent"}
                          </Link>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs uppercase text-f1-muted">
                        {formatPosition(r.result_status, r.finishing_position)}
                      </span>
                      <span className="font-mono text-sm font-bold text-f1-white">{totalPts} pts</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
