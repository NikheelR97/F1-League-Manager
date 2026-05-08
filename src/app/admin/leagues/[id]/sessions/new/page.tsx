import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SessionForm } from "@/components/admin/SessionForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: league },
    { data: circuits, error: circuitsError },
    { data: pointsSystems, error: pointsSystemsError },
  ] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db.from("circuits").select("id, name, country").order("name"),
    db
      .from("points_systems")
      .select("id, name")
      .eq("league_id", leagueId)
      .order("name"),
  ]);

  if (!league) notFound();
  if (circuitsError || pointsSystemsError) {
    return <ErrorState message="Failed to load form data." />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={league.name}
        title="New Race Session"
      />
      {!pointsSystems?.length ? (
        <p className="text-sm text-f1-muted">
          You must add a points system to this league before creating sessions.
        </p>
      ) : (
        <SessionForm
          circuits={circuits ?? []}
          leagueId={leagueId}
          pointsSystems={pointsSystems}
        />
      )}
    </div>
  );
}
