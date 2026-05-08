import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const savePoolSchema = z.object({
  circuit_ids: z.array(z.string().uuid()),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: league } = await db
      .from("leagues")
      .select("id, season_id")
      .eq("id", leagueId)
      .single();

    if (!league) return Response.json({ error: "League not found" }, { status: 404 });

    let body: z.infer<typeof savePoolSchema>;
    try {
      body = savePoolSchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    // Upsert the selected circuits
    const upserts = body.circuit_ids.map((circuitId) => ({
      league_id: leagueId,
      circuit_id: circuitId,
      is_available: true,
    }));

    if (upserts.length > 0) {
      const { error: upsertError } = await db
        .from("league_circuit_pools")
        .upsert(upserts, { onConflict: "league_id,circuit_id" });

      if (upsertError) {
        return Response.json({ error: "Failed to save selected circuits" }, { status: 500 });
      }
    }

    // Set unselected circuits to is_available = false (only if they haven't been used yet)
    // Supabase JS doesn't support complex NOT IN natively easily on updates with multiple conditions
    // We can just fetch all currently available that are NOT in the body, and mark them unavailable
    const { data: currentAvailable } = await db
      .from("league_circuit_pools")
      .select("circuit_id")
      .eq("league_id", leagueId)
      .eq("is_available", true);

    if (currentAvailable) {
      const toRemove = currentAvailable
        .map((c) => c.circuit_id)
        .filter((id) => !body.circuit_ids.includes(id));

      if (toRemove.length > 0) {
        const { error: removeError } = await db
          .from("league_circuit_pools")
          .update({ is_available: false })
          .eq("league_id", leagueId)
          .in("circuit_id", toRemove)
          .is("used_at", null); // Never make a used circuit "available" or modify its state unnecessarily

        if (removeError) {
          return Response.json({ error: "Failed to remove unselected circuits" }, { status: 500 });
        }
      }
    }

    await writeAdminAuditLog({
      action: "circuit_pool.updated",
      actorId: auth.user.id,
      entityId: leagueId,
      entityType: "league",
      metadata: { added_count: upserts.length },
    });

    return Response.json({ ok: true });
  });
}
