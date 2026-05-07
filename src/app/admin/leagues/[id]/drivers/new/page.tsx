import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AddLeagueDriverForm } from "@/components/admin/AddLeagueDriverForm";
import { MAX_DRIVERS_LIST, MAX_TEAMS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function AddLeagueDriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [{ data: league }, { data: drivers }, { data: teams }] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db
      .from("drivers")
      .select("id, display_name, racing_number")
      .eq("is_active", true)
      .order("display_name")
      .limit(MAX_DRIVERS_LIST),
    db
      .from("teams")
      .select("id, name, color_hex")
      .eq("league_id", leagueId)
      .order("name")
      .limit(MAX_TEAMS_LIST),
  ]);

  if (!league) notFound();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Adding a driver to ${league.name}`}
        title="Add Driver"
      />
      <div className="max-w-xl">
        <AddLeagueDriverForm
          drivers={drivers ?? []}
          leagueId={leagueId}
          teams={teams ?? []}
        />
      </div>
    </div>
  );
}
