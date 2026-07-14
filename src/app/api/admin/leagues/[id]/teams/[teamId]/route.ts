import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { cacheTag } from "@/lib/cache/tags";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Editing is limited to name/slug/colour — `kind` and `official_template_id`
// are set at creation and not revisited here.
const updateTeamSchema = z.object({
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex colour like #FF0000"),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId, teamId } = await params;
    const body = await req.json();
    const parsed = updateTeamSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    const { data: existing, error: existingError } = await db
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("league_id", leagueId)
      .maybeSingle();
    if (existingError) {
      return Response.json({ error: "Failed to load team" }, { status: 500 });
    }
    if (!existing) {
      return Response.json({ error: "Team not found" }, { status: 404 });
    }

    const { data: updated, error: updateError } = await db
      .from("teams")
      .update(parsed.data)
      .eq("id", teamId)
      .select("id, name, slug, kind, color_hex")
      .single();

    if (updateError || !updated) {
      if (updateError?.code === "23505") {
        return Response.json({ error: "A team with that slug already exists in this league" }, { status: 409 });
      }
      return Response.json({ error: "Failed to update team" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "team.updated",
      actorId: auth.user.id,
      entityId: updated.id,
      entityType: "team",
      metadata: { league_id: leagueId, name: parsed.data.name },
    });

    revalidateTag(cacheTag.league(leagueId), "default");

    return Response.json({ team: updated });
  });
}
