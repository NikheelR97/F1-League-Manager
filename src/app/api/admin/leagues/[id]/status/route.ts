import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["archived"],
};

const bodySchema = z.object({
  status: z.enum(["active", "archived"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: league } = await db
      .from("leagues")
      .select("id, status")
      .eq("id", leagueId)
      .single();

    if (!league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    const allowed = ALLOWED_TRANSITIONS[league.status] ?? [];
    if (!allowed.includes(body.status)) {
      return Response.json(
        { error: `Cannot transition from '${league.status}' to '${body.status}'` },
        { status: 422 },
      );
    }

    const { error } = await db
      .from("leagues")
      .update({ status: body.status })
      .eq("id", leagueId);

    if (error) {
      return Response.json({ error: "Failed to update status" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: `league.status_changed`,
      actorId: auth.user.id,
      entityId: leagueId,
      entityType: "league",
      metadata: { from: league.status, to: body.status },
    });

    return Response.json({ status: body.status }, { status: 200 });
  });
}
