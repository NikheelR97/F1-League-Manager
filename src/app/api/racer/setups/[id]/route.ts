import { type NextRequest } from "next/server";
import { z } from "zod";

import { withRacerGuard } from "@/lib/racer/api-guard";
import { updateSetupSchema } from "@/lib/racer/setup-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

async function resolveOwnedSetup(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  setupId: string,
  userId: string,
) {
  const { data: setup, error } = await db
    .from("vehicle_setups")
    .select("id, driver_id, name, drivers!inner(profile_id)")
    .eq("id", setupId)
    .maybeSingle();

  if (error || !setup) return null;

  // Verify ownership: the setup's driver must be linked to this user
  const driver = setup.drivers as unknown as { profile_id: string | null };
  if (driver.profile_id !== userId) return null;

  return setup;
}

// PATCH /api/racer/setups/[id] — update a setup
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRacerGuard(req, async (_req, { userId }) => {
    const { id: setupId } = await params;
    const db = createSupabaseServiceRoleClient();

    const owned = await resolveOwnedSetup(db, setupId, userId);
    if (!owned) {
      return Response.json({ error: "Setup not found" }, { status: 404 });
    }

    let body: z.infer<typeof updateSetupSchema>;
    try {
      body = updateSetupSchema.parse(await req.json());
    } catch (e) {
      if (e instanceof z.ZodError) {
        return Response.json({ error: e.flatten() }, { status: 422 });
      }
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    if (Object.keys(body).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await db
      .from("vehicle_setups")
      .update(body)
      .eq("id", setupId)
      .select("id, name, circuit_id, driver_id, updated_at")
      .single();

    if (error) {
      return Response.json({ error: "Failed to update setup" }, { status: 500 });
    }

    return Response.json({ setup: data });
  });
}

// DELETE /api/racer/setups/[id] — delete a setup
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRacerGuard(req, async (_req, { userId }) => {
    const { id: setupId } = await params;
    const db = createSupabaseServiceRoleClient();

    const owned = await resolveOwnedSetup(db, setupId, userId);
    if (!owned) {
      return Response.json({ error: "Setup not found" }, { status: 404 });
    }

    const { error } = await db
      .from("vehicle_setups")
      .delete()
      .eq("id", setupId);

    if (error) {
      return Response.json({ error: "Failed to delete setup" }, { status: 500 });
    }

    return new Response(null, { status: 204 });
  });
}
