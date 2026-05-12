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
      .select("id, is_current, is_archived")
      .eq("id", seasonId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return Response.json({ error: "Failed to load season" }, { status: 500 });
    }
    if (!season) {
      return Response.json({ error: "Season not found" }, { status: 404 });
    }
    if (season.is_current) {
      return Response.json(
        { error: "Cannot archive the current season" },
        { status: 422 },
      );
    }

    const newArchived = !season.is_archived;

    const { error } = await db
      .from("seasons")
      .update({ is_archived: newArchived })
      .eq("id", seasonId);

    if (error) {
      return Response.json({ error: "Failed to update season" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: newArchived ? "season.archived" : "season.unarchived",
      actorId: auth.user.id,
      entityId: seasonId,
      entityType: "season",
      metadata: {},
    });

    return Response.json({ is_archived: newArchived });
  });
}
