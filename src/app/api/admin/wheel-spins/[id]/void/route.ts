import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: spinId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: spin, error: fetchError } = await db
      .from("wheel_spins")
      .select("id, status, league_id")
      .eq("id", spinId)
      .single();

    if (fetchError || !spin) {
      return Response.json({ error: "Spin not found" }, { status: 404 });
    }

    if (spin.status !== "pending") {
      return Response.json({ error: "Can only void pending spins" }, { status: 400 });
    }

    const { error: updateError } = await db
      .from("wheel_spins")
      .update({ status: "void" })
      .eq("id", spinId);

    if (updateError) {
      return Response.json({ error: "Failed to void spin" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "wheel.voided",
      actorId: auth.user.id,
      entityId: spin.id,
      entityType: "wheel_spin",
      metadata: { league_id: spin.league_id },
    });

    return Response.json({ success: true });
  });
}
