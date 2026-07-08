import "server-only";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MAX_RESERVE_ASSIGNMENTS_LIST } from "@/lib/constants";
import { formatDate } from "@/lib/format-date";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// B7 — this page used to be a dead-end stub telling admins to go elsewhere.
// Reserve assignments are actually recorded from a session's Results step
// (Team column + "Covering for" select); this page just lists what's been
// recorded so far, across every league.
export default async function ReservesPage() {
  const db = createSupabaseServiceRoleClient();

  const { data: assignments, error } = await db
    .from("race_reserve_assignments")
    .select("id, created_at, race_session_id, original_driver_id, reserve_driver_id, team_id")
    .order("created_at", { ascending: false })
    .limit(MAX_RESERVE_ASSIGNMENTS_LIST);

  if (error) {
    return <ErrorState message="Failed to load reserve assignments." />;
  }

  const rows = assignments ?? [];

  const description =
    "Recorded when a reserve driver's result is published. Made from a session's Results step — set the reserve's Team to who they raced for, and Covering For to the driver they replaced.";

  if (rows.length === 0) {
    return (
      <div className="space-y-8">
        <AdminPageHeader description={description} title="Reserve Assignments" />
        <EmptyState
          message="No reserve driver has covered a race yet. Record one from a session's Results step."
          title="No reserve assignments"
        />
      </div>
    );
  }

  const sessionIds = [...new Set(rows.map((a) => a.race_session_id))];
  const driverIds = [...new Set(rows.flatMap((a) => [a.original_driver_id, a.reserve_driver_id]))];
  const teamIds = [...new Set(rows.map((a) => a.team_id))];

  const [{ data: sessions }, { data: drivers }, { data: teams }] = await Promise.all([
    db
      .from("race_sessions")
      .select("id, name, scheduled_at, leagues(name)")
      .in("id", sessionIds),
    db.from("drivers").select("id, display_name").in("id", driverIds),
    db.from("teams").select("id, name, color_hex").in("id", teamIds),
  ]);

  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));
  const driverById = new Map((drivers ?? []).map((d) => [d.id, d]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  return (
    <div className="space-y-8">
      <AdminPageHeader description={description} title="Reserve Assignments" />
      <div className="overflow-x-auto border border-f1-border bg-f1-dark">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border text-left text-xs text-f1-muted">
              <th className="p-3">Date</th>
              <th className="p-3">Session</th>
              <th className="p-3">Reserve</th>
              <th className="p-3">Covering for</th>
              <th className="p-3">Team</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-f1-border">
            {rows.map((a) => {
              const session = sessionById.get(a.race_session_id);
              const league = session?.leagues as unknown as { name: string } | null;
              const team = teamById.get(a.team_id);
              return (
                <tr key={a.id}>
                  <td className="p-3 font-mono text-f1-muted">
                    {session ? formatDate(session.scheduled_at) : "—"}
                  </td>
                  <td className="p-3 text-f1-white">
                    {session?.name ?? "Unknown session"}
                    {league && <span className="ml-2 text-xs text-f1-muted">{league.name}</span>}
                  </td>
                  <td className="p-3 text-f1-white">
                    {driverById.get(a.reserve_driver_id)?.display_name ?? "Unknown"}
                  </td>
                  <td className="p-3 text-f1-muted">
                    {driverById.get(a.original_driver_id)?.display_name ?? "Unknown"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-0.5 shrink-0"
                        style={{ backgroundColor: team?.color_hex ?? "#444444" }}
                      />
                      <span className="text-f1-white">{team?.name ?? "Unknown"}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
