import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TransferForm } from "@/components/admin/TransferForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDate } from "@/lib/format-date";
import { MAX_DRIVERS_LIST, MAX_TEAMS_PER_LEAGUE } from "@/lib/constants";
import { getCurrentSeason } from "@/lib/leagues/get-current-season";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_SESSIONS_LIST = 20;

export default async function NewTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: league, error: leagueError },
    currentSeason,
    { data: teams, error: teamsError },
  ] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    getCurrentSeason(db, leagueId),
    db
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId)
      .order("name")
      .limit(MAX_TEAMS_PER_LEAGUE),
  ]);

  if (leagueError && leagueError.code !== "PGRST116") {
    return <ErrorState message="Failed to load league." />;
  }

  if (teamsError) {
    return <ErrorState message="Failed to load transfer data." />;
  }

  if (!league) notFound();

  const effectiveSeasonId = currentSeason?.id ?? null;

  const [{ data: entries, error: entriesError }, { data: raceSessions }] = effectiveSeasonId
    ? await Promise.all([
        db
          .from("league_driver_entries")
          .select("id, is_reserve, drivers(display_name), driver_team_stints(ends_on, team_id, teams(name))")
          .eq("league_id", leagueId)
          .eq("season_id", effectiveSeasonId)
          .is("left_on", null)
          .order("joined_on")
          .limit(MAX_DRIVERS_LIST),
        db
          .from("race_sessions")
          .select("id, name, scheduled_at")
          .eq("league_id", leagueId)
          .eq("season_id", effectiveSeasonId)
          .eq("status", "completed")
          .order("scheduled_at", { ascending: false })
          .limit(MAX_SESSIONS_LIST),
      ])
    : [{ data: [], error: null }, { data: [] }];

  if (entriesError) {
    return <ErrorState message="Failed to load transfer data." />;
  }

  type EntryRow = {
    driver_team_stints: Array<{ ends_on: string | null; team_id: string; teams: { name: string } | null }> | null;
    drivers: { display_name: string } | null;
    id: string;
    is_reserve: boolean;
  };

  const rows = (entries ?? []) as unknown as EntryRow[];

  // M10a — count active primary (non-reserve) stints per team so the form can
  // show "Alpine (2/2 — full)" and disable full teams for primary drivers.
  const teamPrimaryCounts = new Map<string, number>();
  for (const e of rows) {
    const activeStint = e.driver_team_stints?.find((s) => s.ends_on === null);
    if (activeStint && !e.is_reserve) {
      teamPrimaryCounts.set(activeStint.team_id, (teamPrimaryCounts.get(activeStint.team_id) ?? 0) + 1);
    }
  }

  const drivers = rows.map((e) => {
    const activeStint = e.driver_team_stints?.find((s) => s.ends_on === null);
    return {
      entryId: e.id,
      isReserve: e.is_reserve,
      // B5 — no active stint means the driver is a free agent, not "gone".
      name: e.drivers?.display_name ?? "Unknown",
      teamName: activeStint?.teams?.name ?? "Free Agent",
    };
  });

  const teamsWithCounts = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    primaryCount: teamPrimaryCounts.get(t.id) ?? 0,
  }));

  const sessions = (raceSessions ?? []).map((s) => ({
    date: s.scheduled_at.slice(0, 10),
    id: s.id,
    label: `${s.name} · ${formatDate(s.scheduled_at)}`,
  }));

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Recording a transfer within ${league.name}`}
        title="Record Transfer"
      />
      <div className="max-w-xl">
        {effectiveSeasonId ? (
          <TransferForm
            drivers={drivers}
            leagueId={leagueId}
            sessions={sessions}
            teams={teamsWithCounts}
          />
        ) : (
          <p className="text-sm text-f1-muted">
            This league has no current season yet — create one before recording transfers.
          </p>
        )}
      </div>
    </div>
  );
}
