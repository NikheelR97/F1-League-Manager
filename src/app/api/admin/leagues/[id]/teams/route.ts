import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_PRIMARY_DRIVERS_PER_TEAM, MAX_TEAMS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const createTeamSchema = z.object({
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex colour like #FF0000"),
  kind: z.enum(["official", "custom"]),
  name: z.string().trim().min(1).max(100),
  official_template_id: z.string().uuid().nullable().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async () => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("teams")
      .select("id, name, slug, kind, color_hex, logo_path, car_image_path, official_template_id")
      .eq("league_id", leagueId)
      .order("name")
      .limit(MAX_TEAMS_LIST);

    if (error) return Response.json({ error: "Failed to load teams" }, { status: 500 });
    return Response.json({ teams: data });
  }, { skipCsrf: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const body = await req.json();
    const parsed = createTeamSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    // Enforce MAX_TEAMS_PER_LEAGUE
    const { count } = await db
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId);

    if ((count ?? 0) >= MAX_TEAMS_LIST) {
      return Response.json({ error: "League team limit reached" }, { status: 422 });
    }

    const { data, error } = await db
      .from("teams")
      .insert({ ...parsed.data, league_id: leagueId })
      .select("id, name, slug, kind, color_hex")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A team with that slug already exists in this league" }, { status: 409 });
      }
      return Response.json({ error: "Failed to create team" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "team.created",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "team",
      metadata: { league_id: leagueId, name: parsed.data.name },
    });

    return Response.json({ team: data }, { status: 201 });
  });
}
