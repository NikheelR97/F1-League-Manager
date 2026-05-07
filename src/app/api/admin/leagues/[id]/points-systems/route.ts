import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_POINTS_POSITIONS } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const pointsByPositionSchema = z
  .record(
    z.string().regex(/^\d+$/, "Key must be a position number"),
    z.number().int().min(0).max(999),
  )
  .refine(
    (v) => Object.keys(v).length > 0 && Object.keys(v).length <= MAX_POINTS_POSITIONS,
    { message: `Must have 1–${MAX_POINTS_POSITIONS} positions` },
  );

const createPointsSystemSchema = z.object({
  fastest_lap_points: z.number().int().min(0).max(10).default(1),
  max_positions: z.number().int().min(1).max(MAX_POINTS_POSITIONS).default(10),
  name: z.string().trim().min(1).max(80),
  points_by_position: pointsByPositionSchema,
  pole_position_points: z.number().int().min(0).max(10).default(0),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async () => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("points_systems")
      .select("id, name, points_by_position, fastest_lap_points, pole_position_points, max_positions")
      .eq("league_id", leagueId)
      .order("name");

    if (error) return Response.json({ error: "Failed to load points systems" }, { status: 500 });
    return Response.json({ points_systems: data });
  }, { skipCsrf: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const body = await req.json();
    const parsed = createPointsSystemSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("points_systems")
      .insert({ ...parsed.data, league_id: leagueId })
      .select("id, name")
      .single();

    if (error) {
      return Response.json({ error: "Failed to create points system" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "points_system.created",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "points_system",
      metadata: { league_id: leagueId, name: parsed.data.name },
    });

    return Response.json({ points_system: data }, { status: 201 });
  });
}
