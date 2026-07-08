import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TeamForm } from "@/components/admin/TeamForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function NewTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: league, error: leagueError },
    { data: templates, error: templatesError },
  ] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db
      .from("official_team_templates")
      .select("id, name, slug, color_hex")
      .order("sort_order"),
  ]);

  if (leagueError && leagueError.code !== "PGRST116") {
    return <ErrorState message="Failed to load league." />;
  }

  if (templatesError) {
    return <ErrorState message="Failed to load official team templates." />;
  }

  if (!league) notFound();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Adding a team to ${league.name}`}
        title="New Team"
      />
      <div className="max-w-xl">
        <TeamForm
          leagueId={leagueId}
          officialTemplates={templates ?? []}
        />
      </div>
    </div>
  );
}
