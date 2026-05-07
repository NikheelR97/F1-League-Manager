import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_LEAGUES_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const createLeagueSchema = z.object({
  constructor_championship_enabled: z.boolean().default(true),
  fastest_lap_enabled: z.boolean().default(true),
  format: z.enum(["informal", "standard", "custom"]),
  name: z.string().trim().min(1).max(100),
  penalty_threshold: z.number().int().min(1).max(99).default(12),
  pole_position_enabled: z.boolean().default(false),
  season_id: z.string().uuid(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase letters, numbers, and hyphens only",
  }),
});

export async function GET(req: NextRequest) {
  return withAdminGuard(req, async () => {
    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("leagues")
      .select("id, name, slug, format, status, season_id, seasons(name)")
      .order("created_at", { ascending: false })
      .limit(MAX_LEAGUES_LIST);

    if (error) return Response.json({ error: "Failed to load leagues" }, { status: 500 });
    return Response.json({ leagues: data });
  }, { skipCsrf: true });
}

export async function POST(req: NextRequest) {
  return withAdminGuard(req, async (_req, auth) => {
    const body = await req.json();
    const parsed = createLeagueSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("leagues")
      .insert({ ...parsed.data, created_by: auth.user.id })
      .select("id, name, slug, format, status")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A league with that slug already exists" }, { status: 409 });
      }
      return Response.json({ error: "Failed to create league" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "league.created",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "league",
      metadata: { format: parsed.data.format, name: parsed.data.name, slug: parsed.data.slug },
    });

    return Response.json({ league: data }, { status: 201 });
  });
}
