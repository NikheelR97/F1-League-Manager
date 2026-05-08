import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LeagueAssetUpload } from "@/components/admin/LeagueAssetUpload";
import { LeagueStatusButton } from "@/components/admin/LeagueStatusButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { MAX_DRIVERS_LIST, MAX_TEAMS_PER_LEAGUE } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_SESSIONS_LIST = 20;

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: league, error: leagueError },
    { data: teams, error: teamsError },
    { data: entries, error: entriesError },
    { data: pointsSystems, error: pointsSystemsError },
    { data: sessions },
  ] = await Promise.all([
    db
      .from("leagues")
      .select("id, name, slug, format, status, fastest_lap_enabled, pole_position_enabled, constructor_championship_enabled, penalty_threshold, seasons(name)")
      .eq("id", leagueId)
      .single(),
    db
      .from("teams")
      .select("id, name, slug, kind, color_hex")
      .eq("league_id", leagueId)
      .order("name")
      .limit(MAX_TEAMS_PER_LEAGUE),
    db
      .from("league_driver_entries")
      .select("id, is_reserve, drivers(display_name, racing_number), driver_team_stints(team_id, ends_on, teams(name, color_hex))")
      .eq("league_id", leagueId)
      .is("left_on", null)
      .order("joined_on")
      .limit(MAX_DRIVERS_LIST),
    db
      .from("points_systems")
      .select("id, name, fastest_lap_points, pole_position_points, max_positions")
      .eq("league_id", leagueId)
      .order("name"),
    db
      .from("race_sessions")
      .select("id, name, session_code, scheduled_at, status, circuits(name, country)")
      .eq("league_id", leagueId)
      .order("scheduled_at", { ascending: false })
      .limit(MAX_SESSIONS_LIST),
  ]);

  if (leagueError && leagueError.code !== "PGRST116") {
    return <ErrorState message="Failed to load league." />;
  }

  if (teamsError || entriesError || pointsSystemsError) {
    return <ErrorState message="Failed to load league management data." />;
  }

  if (!league) notFound();

  const seasonName = (league.seasons as unknown as { name: string } | null)?.name ?? "—";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          description={`${league.format} · ${seasonName}`}
          title={league.name}
        />
        <div className="flex flex-col items-end gap-2 pt-1 shrink-0">
          <span
            className={`border px-2 py-0.5 text-xs font-bold uppercase ${
              league.status === "active"
                ? "border-team-sauber text-team-sauber"
                : "border-f1-muted text-f1-muted"
            }`}
          >
            {league.status}
          </span>
          <LeagueStatusButton currentStatus={league.status} leagueId={leagueId} />
        </div>
      </div>

      {/* Meta */}
      <section className="grid grid-cols-2 gap-4 border border-f1-border bg-f1-dark p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-f1-muted">Slug</p>
          <p className="font-mono text-f1-white">{league.slug}</p>
        </div>
        <div>
          <p className="text-xs text-f1-muted">Penalty threshold</p>
          <p className="text-f1-white">{league.penalty_threshold} pts</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-f1-muted">Scoring options</p>
          <p className="text-f1-white">
            {[
              league.fastest_lap_enabled && "Fastest lap",
              league.pole_position_enabled && "Pole position",
              league.constructor_championship_enabled && "Constructors",
            ]
              .filter(Boolean)
              .join(" · ") || "None"}
          </p>
        </div>
      </section>

      {/* Assets */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase text-f1-muted">Assets</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <LeagueAssetUpload kind="logo" label="League Logo" leagueId={leagueId} />
          <LeagueAssetUpload kind="hero_image" label="Hero Image" leagueId={leagueId} />
        </div>
      </section>

      {/* Points Systems */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-f1-muted">Points Systems</h2>
          <Link
            className="flex items-center gap-2 border border-f1-red bg-f1-red px-3 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
            href={`/admin/leagues/${leagueId}/points-systems/new`}
          >
            <Plus aria-hidden="true" size={12} />
            Add Points System
          </Link>
        </div>
        {!pointsSystems?.length ? (
          <p className="text-sm text-f1-muted">
            No points systems yet. Add one before scheduling race sessions.
          </p>
        ) : (
          <ul className="space-y-2">
            {pointsSystems.map((ps) => (
              <li key={ps.id}>
                <div className="border border-f1-border bg-f1-dark p-4">
                  <p className="font-bold text-f1-white">{ps.name}</p>
                  <p className="font-mono text-xs text-f1-muted">
                    Top {ps.max_positions} · FL +{ps.fastest_lap_points} · Pole +{ps.pole_position_points}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sessions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-f1-muted">
            Race Sessions ({sessions?.length ?? 0})
          </h2>
          <Link
            className="flex items-center gap-2 border border-f1-red bg-f1-red px-3 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
            href={`/admin/leagues/${leagueId}/sessions/new`}
          >
            <Plus aria-hidden="true" size={12} />
            Add Session
          </Link>
        </div>
        {!sessions?.length ? (
          <p className="text-sm text-f1-muted">No sessions yet. Add one to start entering results.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const circuit = session.circuits as unknown as { country: string; name: string } | null;
              const isPublishable = session.status !== "completed";
              return (
                <li key={session.id}>
                  <div className="flex items-center justify-between border border-f1-border bg-f1-dark p-4">
                    <div>
                      <p className="font-bold text-f1-white">{session.name}</p>
                      <p className="font-mono text-xs text-f1-muted">
                        {session.session_code}
                        {circuit ? ` · ${circuit.name}, ${circuit.country}` : ""}
                        {" · "}
                        {new Date(session.scheduled_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`border px-2 py-0.5 text-xs font-bold uppercase ${
                          session.status === "completed"
                            ? "border-team-sauber text-team-sauber"
                            : "border-f1-muted text-f1-muted"
                        }`}
                      >
                        {session.status}
                      </span>
                      {isPublishable && (
                        <Link
                          className="border border-f1-border px-3 py-1 text-xs font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white"
                          href={`/admin/leagues/${leagueId}/sessions/${session.id}/publish`}
                        >
                          Enter Results
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Teams */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-f1-muted">
            Teams ({teams?.length ?? 0}/{MAX_TEAMS_PER_LEAGUE})
          </h2>
          <Link
            className="flex items-center gap-2 border border-f1-red bg-f1-red px-3 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
            href={`/admin/leagues/${leagueId}/teams/new`}
          >
            <Plus aria-hidden="true" size={12} />
            Add Team
          </Link>
        </div>

        {!teams?.length ? (
          <p className="text-sm text-f1-muted">No teams yet. Add one to get started.</p>
        ) : (
          <ul className="space-y-2">
            {teams.map((team) => (
              <li key={team.id}>
                <div className="flex items-center justify-between border border-f1-border bg-f1-dark p-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-4 w-1 shrink-0"
                      style={{ backgroundColor: team.color_hex }}
                    />
                    <div>
                      <p className="font-bold text-f1-white">{team.name}</p>
                      <p className="font-mono text-xs text-f1-muted">
                        {team.slug} · {team.kind}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Drivers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-f1-muted">
            Drivers ({entries?.length ?? 0})
          </h2>
          <div className="flex items-center gap-2">
            <Link
              className="flex items-center gap-2 border border-f1-border px-3 py-1.5 text-xs font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white"
              href={`/admin/leagues/${leagueId}/transfers/new`}
            >
              Record Transfer
            </Link>
            <Link
              className="flex items-center gap-2 border border-f1-red bg-f1-red px-3 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
              href={`/admin/leagues/${leagueId}/drivers/new`}
            >
              <Plus aria-hidden="true" size={12} />
              Add Driver
            </Link>
          </div>
        </div>

        {!entries?.length ? (
          <p className="text-sm text-f1-muted">No drivers assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const driver = entry.drivers as unknown as { display_name: string; racing_number: number | null } | null;
              const stints = entry.driver_team_stints as unknown as Array<{ ends_on: string | null; teams: { color_hex: string; name: string } | null }> | null;
              const activeStint = stints?.find((s) => s.ends_on === null);
              const teamName = activeStint?.teams?.name ?? "Unassigned";
              const teamColor = activeStint?.teams?.color_hex ?? "#444444";
              return (
                <li key={entry.id}>
                  <div className="flex items-center justify-between border border-f1-border bg-f1-dark p-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="h-4 w-1 shrink-0"
                        style={{ backgroundColor: teamColor }}
                      />
                      <div>
                        <p className="font-bold text-f1-white">
                          {driver?.display_name ?? "Unknown"}
                          {driver?.racing_number ? (
                            <span className="ml-2 font-mono text-xs text-f1-muted">
                              #{driver.racing_number}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-f1-muted">{teamName}</p>
                      </div>
                    </div>
                    {entry.is_reserve && (
                      <span className="border border-f1-muted px-2 py-0.5 text-xs font-bold uppercase text-f1-muted">
                        Reserve
                      </span>
                    )}
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
