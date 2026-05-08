import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("id, season_id")
      .eq("id", leagueId)
      .single();

    if (leagueError || !league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    // Check if there's already a pending spin
    const { data: pending } = await db
      .from("wheel_spins")
      .select("id")
      .eq("league_id", leagueId)
      .eq("status", "pending")
      .maybeSingle();

    if (pending) {
      return Response.json({ error: "There is already a pending wheel spin. Confirm or void it first." }, { status: 400 });
    }

    // Get available circuits
    const { data: availableCircuits } = await db
      .from("league_circuit_pools")
      .select("circuit_id, circuits(name, country)")
      .eq("league_id", leagueId)
      .eq("is_available", true);

    if (!availableCircuits || availableCircuits.length === 0) {
      return Response.json({ error: "No circuits available in the pool." }, { status: 400 });
    }

    // Server-side random choice
    const randomIndex = Math.floor(Math.random() * availableCircuits.length);
    const chosen = availableCircuits[randomIndex];

    // Create pending spin
    const { data: spin, error: spinError } = await db
      .from("wheel_spins")
      .insert({
        league_id: leagueId,
        season_id: league.season_id,
        circuit_id: chosen.circuit_id,
        status: "pending",
        spun_by: auth.user.id,
      })
      .select("id, circuit_id")
      .single();

    if (spinError || !spin) {
      return Response.json({ error: "Failed to record wheel spin" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "wheel.spun",
      actorId: auth.user.id,
      entityId: spin.id,
      entityType: "wheel_spin",
      metadata: { league_id: leagueId, circuit_id: chosen.circuit_id },
    });

    return Response.json({ spin: { ...spin, circuit: chosen.circuits } });
  });
}
