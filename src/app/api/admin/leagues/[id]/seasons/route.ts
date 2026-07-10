import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_SEASONS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createSeasonSchema = z.object({
  ends_on: z.string().date().nullable().default(null),
  name: z.string().trim().min(1).max(80),
  starts_on: z.string().date(),
}).refine(
  (d) => !d.ends_on || d.ends_on >= d.starts_on,
  { message: "ends_on must be on or after starts_on" },
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async () => {
    const rawParams = await params;
    const parsedParams = paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid league id" }, { status: 422 });
    }
    const { id: leagueId } = parsedParams.data;
    const db = createSupabaseServiceRoleClient();

    const { data, error } = await db
      .from("seasons")
      .select("id, name, starts_on, ends_on, is_current, is_archived")
      .eq("league_id", leagueId)
      .order("starts_on", { ascending: false })
      .limit(MAX_SEASONS_LIST);

    if (error) return Response.json({ error: "Failed to load seasons" }, { status: 500 });
    return Response.json({ seasons: data });
  }, { skipCsrf: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const rawParams = await params;
    const parsedParams = paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid league id" }, { status: 422 });
    }
    const { id: leagueId } = parsedParams.data;

    const body = await req.json();
    const parsed = createSeasonSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("id")
      .eq("id", leagueId)
      .maybeSingle();

    if (leagueError) return Response.json({ error: "Failed to load league" }, { status: 500 });
    if (!league) return Response.json({ error: "League not found" }, { status: 404 });

    // A league's first season becomes current automatically; later seasons
    // only become current via the explicit set-current or carry-over routes.
    const { count, error: countError } = await db
      .from("seasons")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId);

    if (countError) return Response.json({ error: "Failed to check existing seasons" }, { status: 500 });

    const { data, error } = await db
      .from("seasons")
      .insert({ ...parsed.data, is_current: (count ?? 0) === 0, league_id: leagueId })
      .select("id, name, starts_on, ends_on, is_current")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A season with that name already exists in this league" }, { status: 409 });
      }
      return Response.json({ error: "Failed to create season" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "season.created",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "season",
      metadata: { league_id: leagueId, name: parsed.data.name },
    });

    return Response.json({ season: data }, { status: 201 });
  });
}
