import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SessionForm } from "@/components/admin/SessionForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: leagueId, sessionId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: league },
    { data: session, error: sessionError },
    { data: circuits, error: circuitsError },
    { data: pointsSystems, error: pointsSystemsError },
  ] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db
      .from("race_sessions")
      .select("id, circuit_id, name, points_system_id, race_length_percent, race_number, scheduled_at, session_code")
      .eq("id", sessionId)
      .single(),
    db.from("circuits").select("id, name, country").order("name"),
    db
      .from("points_systems")
      .select("id, name")
      .eq("league_id", leagueId)
      .order("name"),
  ]);

  if (!league || !session) notFound();
  if (sessionError || circuitsError || pointsSystemsError) {
    return <ErrorState message="Failed to load form data." />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={league.name}
        title={`Edit ${session.name}`}
      />
      <SessionForm
        circuits={circuits ?? []}
        leagueId={leagueId}
        pointsSystems={pointsSystems ?? []}
        session={session}
      />
    </div>
  );
}
