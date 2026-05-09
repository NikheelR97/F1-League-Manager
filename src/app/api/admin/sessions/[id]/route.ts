import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const SESSION_CODE_RE = /^[A-Z0-9]{6}$/;

const updateSessionSchema = z.object({
  circuit_id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  points_system_id: z.string().uuid().optional(),
  race_length_percent: z.union([z.literal(25), z.literal(50), z.literal(100)]).optional(),
  race_number: z.union([z.literal(1), z.literal(2)]).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  session_code: z.string().regex(SESSION_CODE_RE, "Must be 6 uppercase letters/digits").optional(),
  // status intentionally excluded — transitions happen via /publish (completed) or DELETE (cancelled)
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: sessionId } = await params;
    const db = createSupabaseServiceRoleClient();

    let body: z.infer<typeof updateSessionSchema>;
    try {
      body = updateSessionSchema.parse(await req.json());
    } catch (e) {
      if (e instanceof z.ZodError) {
        return Response.json({ error: e.flatten() }, { status: 422 });
      }
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    if (Object.keys(body).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await db
      .from("race_sessions")
      .select("league_id, name, status")
      .eq("id", sessionId)
      .single();

    if (fetchError || !existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const { data, error } = await db
      .from("race_sessions")
      .update(body)
      .eq("id", sessionId)
      .select("id, name, session_code")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A session with that code already exists" }, { status: 409 });
      }
      return Response.json({ error: "Failed to update session" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "session.updated",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "race_session",
      metadata: { league_id: existing.league_id, changes: body },
    });

    return Response.json({ session: data });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: sessionId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: existing, error: fetchError } = await db
      .from("race_sessions")
      .select("league_id, name, status")
      .eq("id", sessionId)
      .single();

    if (fetchError || !existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.status === "completed") {
      return Response.json({ error: "Cannot delete a completed session" }, { status: 400 });
    }

    const { error } = await db.from("race_sessions").delete().eq("id", sessionId);

    if (error) {
      return Response.json({ error: "Failed to delete session" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "session.deleted",
      actorId: auth.user.id,
      entityId: sessionId,
      entityType: "race_session",
      metadata: { league_id: existing.league_id, name: existing.name },
    });

    return new Response(null, { status: 204 });
  });
}
