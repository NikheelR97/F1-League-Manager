import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TeamForm } from "@/components/admin/TeamForm";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function NewTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [{ data: league }, { data: templates }] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db
      .from("official_team_templates")
      .select("id, name, slug, color_hex")
      .order("sort_order"),
  ]);

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
