import "server-only";

import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export default async function LeagueStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const [
    { data: driverRows },
    { data: teamRows },
    { count: completedCount },
    { data: lastSession },
  ] = await Promise.all([
    db
      .from("driver_standings")
      .select("position, total_points, wins, podiums, fastest_laps, drivers(id, display_name)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("position")
      .limit(30),
    db
      .from("team_standings")
      .select("position, total_points, wins, podiums, teams(id, name, color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("position")
      .limit(15),
    db
      .from("race_sessions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("status", "completed"),
    db
      .from("race_sessions")
      .select("name, published_at")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const drivers = driverRows ?? [];
  const teams = teamRows ?? [];
  const racesCompleted = completedCount ?? 0;

  type DriverRow = { id: string; display_name: string };
  type TeamRow = { id: string; name: string; color_hex: string };

  // Derive stat leaders from driver_standings (precomputed — no recalculation)
  const mostWins = [...drivers].sort((a, b) => b.wins - a.wins).slice(0, 5);
  const mostPodiums = [...drivers].sort((a, b) => b.podiums - a.podiums).slice(0, 5);
  const mostFastestLaps = [...drivers]
    .filter((d) => d.fastest_laps > 0)
    .sort((a, b) => b.fastest_laps - a.fastest_laps)
    .slice(0, 5);

  const hasAnyData = drivers.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={league.season.name}
        title="Statistics"
        updatedAt={lastSession?.published_at ?? null}
      />

      {!hasAnyData ? (
        <EmptyState
          message="Statistics will appear once results are published."
          title="No stats yet"
        />
      ) : (
        <>
          {/* Season at a glance */}
          <div className="grid grid-cols-3 gap-4 border border-f1-border bg-f1-dark p-4">
            <div className="text-center">
              <p className="font-mono text-3xl font-bold text-f1-white">{racesCompleted}</p>
              <p className="mt-1 text-xs uppercase text-f1-muted">Races</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-3xl font-bold text-f1-white">{drivers.length}</p>
              <p className="mt-1 text-xs uppercase text-f1-muted">Drivers</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-3xl font-bold text-f1-white">{teams.length}</p>
              <p className="mt-1 text-xs uppercase text-f1-muted">Teams</p>
            </div>
          </div>

          {/* Driver stat tables */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Most wins */}
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-f1-muted">Most Wins</h2>
              <ul className="space-y-1">
                {mostWins.map((row, i) => {
                  const driver = row.drivers as unknown as DriverRow | null;
                  return (
                    <li
                      key={driver?.id ?? row.position}
                      className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 font-mono text-xs text-f1-muted">{i + 1}</span>
                        <span className="text-f1-white">{driver?.display_name ?? "—"}</span>
                      </div>
                      <span className="font-mono font-bold text-f1-white">{row.wins}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Most podiums */}
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-f1-muted">Most Podiums</h2>
              <ul className="space-y-1">
                {mostPodiums.map((row, i) => {
                  const driver = row.drivers as unknown as DriverRow | null;
                  return (
                    <li
                      key={driver?.id ?? row.position}
                      className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 font-mono text-xs text-f1-muted">{i + 1}</span>
                        <span className="text-f1-white">{driver?.display_name ?? "—"}</span>
                      </div>
                      <span className="font-mono font-bold text-f1-white">{row.podiums}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Most fastest laps */}
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-f1-muted">Fastest Laps</h2>
              {mostFastestLaps.length === 0 ? (
                <p className="text-xs text-f1-muted">No fastest laps recorded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {mostFastestLaps.map((row, i) => {
                    const driver = row.drivers as unknown as DriverRow | null;
                    return (
                      <li
                        key={driver?.id ?? row.position}
                        className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 font-mono text-xs text-f1-muted">{i + 1}</span>
                          <span className="text-f1-white">{driver?.display_name ?? "—"}</span>
                        </div>
                        <span className="font-mono font-bold text-team-mclaren">{row.fastest_laps}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Constructor performance (only if enabled) */}
          {league.constructor_championship_enabled && teams.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase text-f1-muted">Constructor Performance</h2>
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                    <th className="pb-2 pr-4 w-10">Pos</th>
                    <th className="pb-2 pr-4">Constructor</th>
                    <th className="pb-2 pr-4 text-right">Pts</th>
                    <th className="pb-2 pr-4 text-right">W</th>
                    <th className="pb-2 text-right">Pod</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((row) => {
                    const team = row.teams as unknown as TeamRow | null;
                    return (
                      <tr key={row.position} className="border-b border-f1-border/40 hover:bg-f1-dark">
                        <td className="py-2 pr-4 font-mono font-bold text-f1-white">{row.position}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-3 w-1 shrink-0"
                              style={{ backgroundColor: team?.color_hex ?? "#444" }}
                            />
                            <span className="font-bold text-f1-white">{team?.name ?? "—"}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-right font-mono font-bold text-f1-white">{row.total_points}</td>
                        <td className="py-2 pr-4 text-right font-mono text-xs text-f1-white">{row.wins}</td>
                        <td className="py-2 text-right font-mono text-xs text-f1-white">{row.podiums}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile */}
              <ul className="space-y-2 md:hidden">
                {teams.map((row) => {
                  const team = row.teams as unknown as TeamRow | null;
                  return (
                    <li key={row.position} className="border border-f1-border bg-f1-dark p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 font-mono font-bold text-f1-white">{row.position}</span>
                          <span
                            aria-hidden="true"
                            className="h-4 w-1 shrink-0"
                            style={{ backgroundColor: team?.color_hex ?? "#444" }}
                          />
                          <span className="font-bold text-f1-white">{team?.name ?? "—"}</span>
                        </div>
                        <p className="font-mono font-bold text-f1-white">{row.total_points} pts</p>
                      </div>
                      <div className="mt-1 flex gap-4 font-mono text-xs text-f1-muted">
                        <span>{row.wins}W</span>
                        <span>{row.podiums} Pod</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
