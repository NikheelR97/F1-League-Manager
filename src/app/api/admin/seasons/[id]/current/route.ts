import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: seasonId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: season, error: fetchError } = await db
      .from("seasons")
      .select("id, is_archived")
      .eq("id", seasonId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return Response.json({ error: "Failed to load season" }, { status: 500 });
    }
    if (!season) {
      return Response.json({ error: "Season not found" }, { status: 404 });
    }
    if (season.is_archived) {
      return Response.json(
        { error: "Cannot mark an archived season as current" },
        { status: 422 },
      );
    }

    // Clear current flag on all seasons, then set this one.
    const { error: clearError } = await db
      .from("seasons")
      .update({ is_current: false })
      .neq("id", seasonId);

    if (clearError) {
      return Response.json({ error: "Failed to update seasons" }, { status: 500 });
    }

    const { error: setError } = await db
      .from("seasons")
      .update({ is_current: true })
      .eq("id", seasonId);

    if (setError) {
      return Response.json({ error: "Failed to set current season" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "season.set_current",
      actorId: auth.user.id,
      entityId: seasonId,
      entityType: "season",
      metadata: {},
    });

    return Response.json({ ok: true });
  });
}
