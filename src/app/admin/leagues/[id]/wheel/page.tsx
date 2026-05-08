import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { WheelManager } from "@/components/admin/WheelManager";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function AdminWheelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: league },
    { data: allCircuits, error: circuitsError },
    { data: poolData, error: poolError },
    { data: pendingSpinData },
  ] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db.from("circuits").select("id, name, country").order("name"),
    db.from("league_circuit_pools").select("circuit_id").eq("league_id", leagueId).eq("is_available", true),
    db
      .from("wheel_spins")
      .select("id, circuit_id, status, circuits(name, country)")
      .eq("league_id", leagueId)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (!league) notFound();
  if (circuitsError || poolError) {
    return <ErrorState message="Failed to load wheel setup data." />;
  }

  const initialPoolIds = poolData?.map((p) => p.circuit_id) ?? [];

  // Shape pending spin correctly if exists
  const pendingSpin = pendingSpinData ? {
    id: pendingSpinData.id,
    circuit_id: pendingSpinData.circuit_id,
    status: pendingSpinData.status,
    circuit: pendingSpinData.circuits as unknown as { name: string; country: string } | undefined,
  } : null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={league.name}
        title="Digital Wheel Setup & Spin"
      />
      <WheelManager
        allCircuits={allCircuits ?? []}
        initialPoolIds={initialPoolIds}
        leagueId={leagueId}
        pendingSpin={pendingSpin}
      />
    </div>
  );
}
