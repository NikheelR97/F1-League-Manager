import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdjustmentDeleteButton } from "@/components/admin/AdjustmentDeleteButton";
import { AdjustmentForm } from "@/components/admin/AdjustmentForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDate } from "@/lib/format-date";
import { MAX_DRIVERS_LIST, MAX_TEAMS_PER_LEAGUE } from "@/lib/constants";
import { getCurrentSeason } from "@/lib/leagues/get-current-season";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_ADJUSTMENTS_LIST = 100;

export default async function LeagueAdjustmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [{ data: league, error: leagueError }, currentSeason, { data: teams, error: teamsError }] =
    await Promise.all([
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
    return <ErrorState message="Failed to load teams." />;
  }
  if (!league) notFound();

  const effectiveSeasonId = currentSeason?.id ?? null;

  const [{ data: entries, error: entriesError }, { data: adjustments, error: adjustmentsError }] =
    effectiveSeasonId
      ? await Promise.all([
          db
            .from("league_driver_entries")
            .select("driver_id, drivers(display_name)")
            .eq("league_id", leagueId)
            .eq("season_id", effectiveSeasonId)
            .is("left_on", null)
            .order("joined_on")
            .limit(MAX_DRIVERS_LIST),
          db
            .from("championship_adjustments")
            .select(
              "id, adjustment_kind, points_delta, reason, created_at, driver_id, team_id, drivers(display_name), teams(name)",
            )
            .eq("league_id", leagueId)
            .eq("season_id", effectiveSeasonId)
            .order("created_at", { ascending: false })
            .limit(MAX_ADJUSTMENTS_LIST),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (entriesError || adjustmentsError) {
    return <ErrorState message="Failed to load adjustment data." />;
  }

  type EntryRow = { driver_id: string; drivers: { display_name: string } | null };
  const driverRows = (entries ?? []) as unknown as EntryRow[];

  const targets = [
    ...driverRows.map((e) => ({
      label: `Driver: ${e.drivers?.display_name ?? "Unknown"}`,
      value: `driver:${e.driver_id}`,
    })),
    ...(teams ?? []).map((t) => ({ label: `Team: ${t.name}`, value: `team:${t.id}` })),
  ];

  type AdjustmentRow = {
    adjustment_kind: string;
    created_at: string;
    driver_id: string | null;
    drivers: { display_name: string } | null;
    id: string;
    points_delta: number;
    reason: string;
    team_id: string | null;
    teams: { name: string } | null;
  };
  const adjustmentRows = (adjustments ?? []) as unknown as AdjustmentRow[];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Steward decisions applied directly to the championship — post-race bonuses, penalties, and corrections. Changes recalculate standings immediately."
        title={`Adjustments — ${league.name}`}
      />
      <p className="text-xs text-f1-muted">
        Adjustments are applied to published standings totals; they are not itemized publicly.
      </p>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-x-auto">
          {!adjustmentRows.length ? (
            <EmptyState
              message="No adjustments recorded for this season."
              title="No Adjustments"
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-f1-border text-left text-xs uppercase text-f1-muted">
                  <th className="pb-2 pr-4" scope="col">Target</th>
                  <th className="pb-2 pr-4" scope="col">Kind</th>
                  <th className="pb-2 pr-4" scope="col">Points</th>
                  <th className="pb-2 pr-4" scope="col">Reason</th>
                  <th className="pb-2 pr-4" scope="col">Date</th>
                  <th className="pb-2" scope="col"><span className="sr-only">Delete</span></th>
                </tr>
              </thead>
              <tbody>
                {adjustmentRows.map((adj) => {
                  const targetName = adj.driver_id
                    ? adj.drivers?.display_name ?? "Unknown driver"
                    : adj.teams?.name ?? "Unknown team";
                  return (
                    <tr className="border-b border-f1-border align-top" key={adj.id}>
                      <td className="py-2 pr-4 font-bold text-f1-white">{targetName}</td>
                      <td className="py-2 pr-4 capitalize text-f1-muted">{adj.adjustment_kind}</td>
                      <td className="py-2 pr-4 font-mono text-f1-white">
                        {adj.points_delta > 0 ? `+${adj.points_delta}` : adj.points_delta}
                      </td>
                      <td className="py-2 pr-4 text-f1-muted">{adj.reason}</td>
                      <td className="py-2 pr-4 text-xs text-f1-muted">{formatDate(adj.created_at)}</td>
                      <td className="py-2">
                        <AdjustmentDeleteButton adjustmentId={adj.id} targetName={targetName} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          {effectiveSeasonId ? (
            <AdjustmentForm leagueId={leagueId} seasonId={effectiveSeasonId} targets={targets} />
          ) : (
            <p className="text-sm text-f1-muted">
              This league has no current season yet — create one before recording adjustments.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
