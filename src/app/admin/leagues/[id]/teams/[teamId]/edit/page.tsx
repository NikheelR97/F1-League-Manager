import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LeagueAssetUpload } from "@/components/admin/LeagueAssetUpload";
import { TeamForm } from "@/components/admin/TeamForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id: leagueId, teamId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [{ data: league, error: leagueError }, { data: team, error: teamError }] =
    await Promise.all([
      db.from("leagues").select("id, name").eq("id", leagueId).single(),
      db
        .from("teams")
        .select("id, name, slug, kind, color_hex")
        .eq("id", teamId)
        .eq("league_id", leagueId)
        .maybeSingle(),
    ]);

  if (leagueError && leagueError.code !== "PGRST116") {
    return <ErrorState message="Failed to load league." />;
  }
  if (teamError) {
    return <ErrorState message="Failed to load team." />;
  }
  if (!league || !team) notFound();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Edit team for ${league.name}`}
        title={`Edit Team: ${team.name}`}
      />
      <div className="max-w-xl space-y-8">
        <TeamForm initialTeam={team} leagueId={leagueId} />

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-f1-muted">Assets</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <LeagueAssetUpload kind="logo" label="Team Logo" leagueId={leagueId} teamId={teamId} />
            <LeagueAssetUpload kind="car_image" label="Car Image" leagueId={leagueId} teamId={teamId} />
          </div>
        </section>
      </div>
    </div>
  );
}
