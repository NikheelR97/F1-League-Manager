import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TransferForm } from "@/components/admin/TransferForm";
import { MAX_DRIVERS_LIST, MAX_TEAMS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function NewTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [{ data: league }, { data: entries }, { data: teams }] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db
      .from("league_driver_entries")
      .select("id, drivers(display_name), driver_team_stints(ends_on, teams(name))")
      .eq("league_id", leagueId)
      .is("left_on", null)
      .order("joined_on")
      .limit(MAX_DRIVERS_LIST),
    db
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId)
      .order("name")
      .limit(MAX_TEAMS_LIST),
  ]);

  if (!league) notFound();

  const drivers = (entries ?? []).map((e) => {
    const driver = e.drivers as unknown as { display_name: string } | null;
    const stints = e.driver_team_stints as unknown as Array<{ ends_on: string | null; teams: { name: string } | null }> | null;
    const activeStint = stints?.find((s) => s.ends_on === null);
    return {
      entryId: e.id,
      name: driver?.display_name ?? "Unknown",
      teamName: activeStint?.teams?.name ?? "Unassigned",
    };
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Recording a transfer within ${league.name}`}
        title="Record Transfer"
      />
      <div className="max-w-xl">
        <TransferForm
          drivers={drivers}
          leagueId={leagueId}
          teams={teams ?? []}
        />
      </div>
    </div>
  );
}
