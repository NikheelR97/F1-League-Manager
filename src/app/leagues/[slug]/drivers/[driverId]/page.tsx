import "server-only";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { formatDate } from "@/lib/format-date";
import { getDriverPenaltyTotals } from "@/lib/penalties/get-driver-penalty-totals";
import { formatPosition } from "@/lib/public/format-position";
import { pageTitle } from "@/lib/public/page-title";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// ponytail: this refetches the driver's display_name (not cache()-wrapped) —
// a single indexed .single() lookup by primary key, cheap enough not to
// bother wiring a shared cache for a tab title.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; driverId: string }>;
}): Promise<Metadata> {
  const { slug, driverId } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) return { title: pageTitle("Driver") };

  const db = createSupabaseServiceRoleClient();
  const { data: driver } = await db
    .from("drivers")
    .select("display_name")
    .eq("id", driverId)
    .single();

  return { title: pageTitle(`${driver?.display_name ?? "Driver"} — ${league.name}`) };
}

export default async function DriverProfilePage({
  params,
}: {
  params: Promise<{ slug: string; driverId: string }>;
}) {
  const { slug, driverId } = await params;
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
    { data: driver },
    { data: leagueEntry },
    { data: standing },
    { data: completedSessions },
    { data: lastSession },
    penaltyTotals,
  ] = await Promise.all([
    db
      .from("drivers")
      .select("id, display_name, racing_number, country")
      .eq("id", driverId)
      .single(),
    db
      .from("league_driver_entries")
      .select("id")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("driver_id", driverId)
      .maybeSingle(),
    db
      .from("driver_standings")
      .select("position, previous_position, total_points, wins, podiums, fastest_laps, teams(id, name, color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("driver_id", driverId)
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
    getDriverPenaltyTotals(db, league.id, league.season.id),
  ]);

  if (!driver || !leagueEntry) notFound();

  // Step 2: fetch results and team stints scoped to this league's completed sessions / entry
  const sessionIds = (completedSessions ?? []).map((s) => s.id);
  const [{ data: results }, { data: stints }] = await Promise.all([
    sessionIds.length > 0
      ? db
          .from("race_results")
          .select(
            "race_session_id, finishing_position, result_status, fastest_lap, points_awarded, manual_points_adjustment, race_sessions(name, scheduled_at, circuits(name))",
          )
          .eq("driver_id", driverId)
          .in("race_session_id", sessionIds)
          .order("scheduled_at", { referencedTable: "race_sessions", ascending: true })
          .limit(50)
      : { data: [] },
    db
      .from("driver_team_stints")
      .select("team_id, starts_on, ends_on, teams(id, name, color_hex)")
      .eq("league_driver_entry_id", leagueEntry.id)
      .order("starts_on", { ascending: false })
      .limit(10),
  ]);

  const penaltyPoints = penaltyTotals.get(driverId)?.penaltyPoints ?? 0;

  type RaceSession = { name: string; circuits: unknown };
  type Circuit = { name: string };
  type StintTeam = { id: string; name: string; color_hex: string };

  // Cluster B fix: the headline "Team" must agree with the TEAM HISTORY panel
  // below, so both read the same open stint (ends_on null) instead of the
  // headline using driver_standings' denormalized team, which can lag a
  // transfer.
  const currentStint = (stints ?? []).find((s) => s.ends_on === null) ?? null;
  const currentTeam = currentStint ? (currentStint.teams as unknown as StintTeam | null) : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={league.season.name}
        title={driver.display_name}
        updatedAt={lastSession?.published_at ?? null}
      />

      {/* Driver meta */}
      <div className="grid grid-cols-2 gap-4 border border-f1-border bg-f1-dark p-4 text-sm sm:grid-cols-4">
        {driver.racing_number && (
          <div>
            <p className="text-xs text-f1-muted">Number</p>
            <p className="font-mono font-bold text-f1-white">#{driver.racing_number}</p>
          </div>
        )}
        {driver.country && (
          <div>
            <p className="text-xs text-f1-muted">Country</p>
            <p className="text-f1-white">{driver.country}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-f1-muted">Team</p>
          {currentTeam ? (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3 w-1 shrink-0"
                style={{ backgroundColor: currentTeam.color_hex }}
              />
              <span className="font-bold text-f1-white">{currentTeam.name}</span>
            </div>
          ) : (
            <p className="text-f1-muted">Free Agent</p>
          )}
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
              <p className="text-xs text-f1-muted">W / Pod / FL</p>
              <p className="font-mono text-f1-white">
                {standing.wins} / {standing.podiums} / {standing.fastest_laps}
              </p>
            </div>
          </>
        ) : null}
        {penaltyPoints > 0 && (
          <div>
            <p className="text-xs text-f1-muted">Penalty Points</p>
            <p className="font-mono font-bold text-f1-red-text">{penaltyPoints}</p>
          </div>
        )}
      </div>

      {/* Team history */}
      {stints && stints.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase text-f1-muted">Team History</h2>
          <ul className="space-y-1">
            {stints.map((s) => {
              const team = s.teams as unknown as StintTeam | null;
              return (
                <li
                  key={`${s.team_id}-${s.starts_on}`}
                  className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-4 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-3 w-1 shrink-0"
                      style={{ backgroundColor: team?.color_hex ?? "#444" }}
                    />
                    <span className="text-f1-white">{team?.name ?? "—"}</span>
                  </div>
                  <span className="font-mono text-xs text-f1-muted">
                    {formatDate(s.starts_on)} –{" "}
                    {s.ends_on ? formatDate(s.ends_on) : "present"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Race results */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase text-f1-muted">Race Results</h2>
        {!results || results.length === 0 ? (
          <EmptyState message="No results published yet." title="No results" />
        ) : (
          <ul className="space-y-1">
            {results.map((r) => {
              const race = r.race_sessions as unknown as RaceSession | null;
              const circuit = race?.circuits as unknown as Circuit | null;
              const totalPts = r.points_awarded + r.manual_points_adjustment;
              return (
                <li
                  key={r.race_session_id}
                  className="flex items-center justify-between border border-f1-border/40 bg-f1-dark px-4 py-2 text-sm"
                >
                  <div>
                    <div className="text-f1-white">
                      {circuit?.name ?? "—"}
                      {race?.name && <span className="ml-2 text-xs text-f1-muted">{race.name}</span>}
                    </div>
                    {r.fastest_lap && (
                      <span className="ml-2 text-xs font-bold text-team-mclaren">FL</span>
                    )}
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
        )}
      </section>
    </div>
  );
}
