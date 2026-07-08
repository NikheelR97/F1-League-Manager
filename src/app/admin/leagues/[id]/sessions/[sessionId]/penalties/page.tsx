import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PenaltyStatusEditor, type PenaltyStatus } from "@/components/admin/PenaltyStatusEditor";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_PENALTIES_LIST = 100;

export default async function SessionPenaltiesPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: leagueId, sessionId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [{ data: session, error: sessionError }, { data: penalties, error: penaltiesError }] =
    await Promise.all([
      db
        .from("race_sessions")
        .select("id, name")
        .eq("id", sessionId)
        .eq("league_id", leagueId)
        .single(),
      db
        .from("penalties")
        .select(
          "id, penalty_points, reason, status, steward_notes, appeal_notes, driver_id, drivers(display_name)",
        )
        .eq("race_session_id", sessionId)
        .order("created_at")
        .limit(MAX_PENALTIES_LIST),
    ]);

  if (sessionError && sessionError.code !== "PGRST116") {
    return <ErrorState message="Failed to load session." />;
  }
  if (!session) notFound();
  if (penaltiesError) {
    return <ErrorState message="Failed to load penalties." />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Review steward decisions, resolve appeals, and rescind penalties. Changes recalculate standings immediately."
        title={`Penalties — ${session.name}`}
      />
      {!penalties?.length ? (
        <EmptyState
          message="No penalties recorded for this session."
          title="No Penalties"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs uppercase text-f1-muted">
                <th className="pb-2 pr-4" scope="col">Driver</th>
                <th className="pb-2 pr-4" scope="col">Points</th>
                <th className="pb-2 pr-4" scope="col">Reason</th>
                <th className="pb-2 pr-4" scope="col">Steward / Appeal Notes</th>
                <th className="pb-2" scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {penalties.map((penalty) => {
                const driver = penalty.drivers as unknown as { display_name: string } | null;
                const driverName = driver?.display_name ?? "Unknown";
                return (
                  <tr className="border-b border-f1-border align-top" key={penalty.id}>
                    <td className="py-2 pr-4 font-bold text-f1-white">{driverName}</td>
                    <td className="py-2 pr-4 font-mono text-f1-white">{penalty.penalty_points}</td>
                    <td className="py-2 pr-4 text-f1-muted">{penalty.reason}</td>
                    <td className="py-2 pr-4 text-xs text-f1-muted">
                      {penalty.steward_notes && <p>Steward: {penalty.steward_notes}</p>}
                      {penalty.appeal_notes && <p>Appeal: {penalty.appeal_notes}</p>}
                      {!penalty.steward_notes && !penalty.appeal_notes && "—"}
                    </td>
                    <td className="py-2">
                      <PenaltyStatusEditor
                        driverName={driverName}
                        initialStatus={penalty.status as PenaltyStatus}
                        penaltyId={penalty.id}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
