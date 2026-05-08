import "server-only";

import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PositionDelta } from "@/components/ui/PositionDelta";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export default async function DriverStandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const [{ data: rows }, { data: lastSession }] = await Promise.all([
    db
      .from("driver_standings")
      .select(
        "position, previous_position, total_points, wins, podiums, fastest_laps, updated_at, drivers(id, display_name, racing_number), teams(id, name, color_hex)",
      )
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("position")
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
  ]);

  const standings = rows ?? [];
  const leaderPoints = standings[0]?.total_points ?? 0;
  const updatedAt = standings[0]?.updated_at ?? null;

  type DriverRow = { id: string; display_name: string; racing_number: number | null };
  type TeamRow = { id: string; name: string; color_hex: string };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={league.season.name}
        title="Driver Standings"
        updatedAt={updatedAt}
      />

      {standings.length === 0 ? (
        <EmptyState message="Standings will appear once results are published." title="No standings yet" />
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                <th className="pb-2 pr-4 w-10">Pos</th>
                <th className="pb-2 pr-4 w-6" aria-label="Change" />
                <th className="pb-2 pr-4">Driver</th>
                <th className="pb-2 pr-4">Team</th>
                <th className="pb-2 pr-4 text-right">Pts</th>
                <th className="pb-2 pr-4 text-right">Gap</th>
                <th className="pb-2 pr-4 text-right">W</th>
                <th className="pb-2 pr-4 text-right">Pod</th>
                <th className="pb-2 text-right">FL</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const driver = row.drivers as unknown as DriverRow | null;
                const team = row.teams as unknown as TeamRow | null;
                const gap = row.position === 1 ? "—" : `−${leaderPoints - row.total_points}`;
                return (
                  <tr key={row.position} className="border-b border-f1-border/40 hover:bg-f1-dark">
                    <td className="py-2 pr-4 font-mono font-bold text-f1-white">{row.position}</td>
                    <td className="py-2 pr-4">
                      <PositionDelta current={row.position} previous={row.previous_position} />
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-bold text-f1-white">{driver?.display_name ?? "—"}</span>
                      {driver?.racing_number ? (
                        <span className="ml-2 font-mono text-xs text-f1-muted">#{driver.racing_number}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-1 shrink-0"
                          style={{ backgroundColor: team?.color_hex ?? "#444" }}
                        />
                        <span className="text-f1-muted">{team?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono font-bold text-f1-white">{row.total_points}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-muted">{gap}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-white">{row.wins}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-f1-white">{row.podiums}</td>
                    <td className="py-2 text-right font-mono text-xs text-f1-white">{row.fastest_laps}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {standings.map((row) => {
              const driver = row.drivers as unknown as DriverRow | null;
              const team = row.teams as unknown as TeamRow | null;
              const gap = row.position === 1 ? "Leader" : `−${leaderPoints - row.total_points} pts`;
              return (
                <li key={row.position} className="border border-f1-border bg-f1-dark p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-lg font-bold text-f1-white">{row.position}</span>
                      <PositionDelta current={row.position} previous={row.previous_position} />
                      <div>
                        <p className="font-bold text-f1-white">
                          {driver?.display_name ?? "—"}
                          {driver?.racing_number ? (
                            <span className="ml-2 font-mono text-xs text-f1-muted">#{driver.racing_number}</span>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-f1-muted">
                          <span
                            aria-hidden="true"
                            className="h-2 w-1 shrink-0"
                            style={{ backgroundColor: team?.color_hex ?? "#444" }}
                          />
                          {team?.name ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-f1-white">{row.total_points} pts</p>
                      <p className="font-mono text-xs text-f1-muted">{gap}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 font-mono text-xs text-f1-muted">
                    <span>{row.wins}W</span>
                    <span>{row.podiums} Pod</span>
                    <span>{row.fastest_laps} FL</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
