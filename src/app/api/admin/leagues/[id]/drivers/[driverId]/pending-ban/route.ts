import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const paramsSchema = z.object({
  id: z.string().uuid(),
  driverId: z.string().uuid(),
});

const bodySchema = z.object({
  season_id: z.string().uuid(),
  pending_ban: z.boolean().default(true),
});

// M8 — Ban Watch's one-click "Apply ban": flags the driver's current-season
// entry so the next session's publish form pre-selects Status=BAN for them.
// publish-service clears the flag once a ban result is actually published.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; driverId: string }> },
) {
  return withAdminGuard(req, async (req, auth) => {
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid league or driver id" }, { status: 422 });
    }
    const { id: leagueId, driverId } = parsedParams.data;

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    const { data: entry, error: fetchError } = await db
      .from("league_driver_entries")
      .select("id")
      .eq("league_id", leagueId)
      .eq("season_id", body.season_id)
      .eq("driver_id", driverId)
      .is("left_on", null)
      .maybeSingle();

    if (fetchError) {
      return Response.json({ error: "Failed to load driver entry" }, { status: 500 });
    }
    if (!entry) {
      return Response.json({ error: "Driver entry not found in this league/season" }, { status: 404 });
    }

    const { error: updateError } = await db
      .from("league_driver_entries")
      .update({ pending_ban: body.pending_ban })
      .eq("id", entry.id);

    if (updateError) {
      return Response.json({ error: "Failed to update ban status" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: body.pending_ban ? "driver.ban_applied" : "driver.ban_cleared",
      actorId: auth.user.id,
      entityId: driverId,
      entityType: "league_driver_entry",
      metadata: { league_id: leagueId, season_id: body.season_id },
    });

    return Response.json({ ok: true });
  });
}
