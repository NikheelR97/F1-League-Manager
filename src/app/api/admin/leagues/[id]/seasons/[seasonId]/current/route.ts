import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const paramsSchema = z.object({
  id: z.string().uuid(),
  seasonId: z.string().uuid(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; seasonId: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const rawParams = await params;
    const parsedParams = paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid league or season id" }, { status: 422 });
    }
    const { id: leagueId, seasonId } = parsedParams.data;
    const db = createSupabaseServiceRoleClient();

    const { data: season, error: fetchError } = await db
      .from("seasons")
      .select("id, is_archived")
      .eq("id", seasonId)
      .eq("league_id", leagueId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return Response.json({ error: "Failed to load season" }, { status: 500 });
    }
    if (!season) {
      return Response.json({ error: "Season not found in this league" }, { status: 404 });
    }
    if (season.is_archived) {
      return Response.json(
        { error: "Cannot mark an archived season as current" },
        { status: 422 },
      );
    }

    // Clear is_current from this league's other seasons FIRST. The partial
    // unique index (one current season per league) rejects setting this
    // season current while another one in the same league is still current,
    // so — unlike the old global route — clear-then-set is the only safe
    // order here.
    const { error: clearError } = await db
      .from("seasons")
      .update({ is_current: false })
      .eq("league_id", leagueId)
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
      metadata: { league_id: leagueId },
    });

    return Response.json({ ok: true });
  });
}
