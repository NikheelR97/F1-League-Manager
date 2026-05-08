import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const SESSION_CODE_RE = /^[A-Z0-9]{6}$/;

const createSessionSchema = z.object({
  circuit_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  points_system_id: z.string().uuid(),
  race_length_percent: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  race_number: z.union([z.literal(1), z.literal(2)]),
  scheduled_at: z.string().datetime({ offset: true }),
  session_code: z.string().regex(SESSION_CODE_RE, "Must be 6 uppercase letters/digits"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async () => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data, error } = await db
      .from("race_sessions")
      .select("id, name, session_code, race_number, race_length_percent, scheduled_at, status, circuits(name, country)")
      .eq("league_id", leagueId)
      .order("scheduled_at", { ascending: false })
      .limit(50);

    if (error) return Response.json({ error: "Failed to load sessions" }, { status: 500 });
    return Response.json({ sessions: data });
  }, { skipCsrf: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: league } = await db
      .from("leagues")
      .select("id, season_id")
      .eq("id", leagueId)
      .single();

    if (!league) return Response.json({ error: "League not found" }, { status: 404 });

    let body: z.infer<typeof createSessionSchema>;
    try {
      body = createSessionSchema.parse(await req.json());
    } catch (e) {
      if (e instanceof z.ZodError) {
        return Response.json({ error: e.flatten() }, { status: 422 });
      }
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    const { data, error } = await db
      .from("race_sessions")
      .insert({
        circuit_id: body.circuit_id,
        league_id: leagueId,
        name: body.name,
        points_system_id: body.points_system_id,
        race_length_percent: body.race_length_percent,
        race_number: body.race_number,
        scheduled_at: body.scheduled_at,
        season_id: league.season_id,
        session_code: body.session_code,
      })
      .select("id, name, session_code")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A session with that code already exists in this league" }, { status: 409 });
      }
      return Response.json({ error: "Failed to create session" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "session.created",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "race_session",
      metadata: { league_id: leagueId, name: body.name, session_code: body.session_code },
    });

    return Response.json({ session: data }, { status: 201 });
  });
}
