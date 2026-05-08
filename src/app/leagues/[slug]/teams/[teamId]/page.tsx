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

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

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

  const [{ data: activeStints }, { data: raceResults }] = await Promise.all([
    entryIds.length > 0
      ? db
          .from("driver_team_stints")
          .select("league_driver_entry_id")
          .eq("team_id", teamId)
          .is("ends_on", null)
          .in("league_driver_entry_id", entryIds)
      : { data: [] },
    sessionIds.length > 0
      ? db
          .from("race_results")
          .select(
            "race_session_id, finishing_position, result_status, fastest_lap, points_awarded, manual_points_adjustment, drivers(id, display_name), race_sessions(name, circuits(name, grand_prix_name))",
          )
          .eq("team_id", teamId)
          .in("race_session_id", sessionIds)
          .order("race_session_id")
          .limit(50)
      : { data: [] },
  ]);

  // Derive current drivers from active stints
  const activeEntryIds = new Set((activeStints ?? []).map((s) => s.league_driver_entry_id));

  type DriverEntry = { id: string; display_name: string; racing_number: number | null };
  type EntryRow = { id: string; drivers: unknown };

  const currentDrivers = (entries ?? [])
    .filter((e) => activeEntryIds.has(e.id))
    .map((e) => (e as unknown as EntryRow).drivers as DriverEntry | null)
    .filter((d): d is DriverEntry => d !== null);

  type RaceSession = { name: string; circuits: unknown };
  type Circuit = { name: string; grand_prix_name: string };
  type Driver = { id: string; display_name: string };

  const sortedResults = [...(raceResults ?? [])].sort((a, b) => {
    const aStatus = STATUS_SORT[a.result_status] ?? 0;
    const bStatus = STATUS_SORT[b.result_status] ?? 0;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return (a.finishing_position ?? 99) - (b.finishing_position ?? 99);
  });

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
      </div>

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
                  const isClassified = r.result_status === "classified";
                  const totalPts = r.points_awarded + r.manual_points_adjustment;
                  return (
                    <tr key={`${r.race_session_id}-${driver?.id}`} className="border-b border-f1-border/40 hover:bg-f1-dark">
                      <td className="py-2 pr-4 text-f1-white">
                        {circuit?.grand_prix_name ?? race?.name ?? "—"}
                        {r.fastest_lap && (
                          <span className="ml-2 text-xs font-bold text-team-mclaren">FL</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-f1-muted">{driver?.display_name ?? "—"}</td>
                      <td className="py-2 pr-4 text-right font-mono text-xs text-f1-muted">
                        {isClassified ? `P${r.finishing_position}` : r.result_status.toUpperCase()}
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
                const isClassified = r.result_status === "classified";
                const totalPts = r.points_awarded + r.manual_points_adjustment;
                return (
                  <li
                    key={`${r.race_session_id}-${driver?.id}`}
                    className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-4 py-2 text-sm"
                  >
                    <div>
                      <span className="text-f1-white">{circuit?.grand_prix_name ?? race?.name ?? "—"}</span>
                      {r.fastest_lap && (
                        <span className="ml-2 text-xs font-bold text-team-mclaren">FL</span>
                      )}
                      <p className="text-xs text-f1-muted">{driver?.display_name ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs uppercase text-f1-muted">
                        {isClassified ? `P${r.finishing_position}` : r.result_status.toUpperCase()}
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
