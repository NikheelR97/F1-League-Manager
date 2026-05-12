import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  role: z.enum(["racer", "admin", "super_admin"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    if (auth.role !== "super_admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawParams = await params;
    const parsedParams = paramsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return Response.json({ error: "Invalid user id" }, { status: 422 });
    }
    const { id: targetId } = parsedParams.data;

    // Prevent super_admin from demoting themselves.
    if (targetId === auth.user.id) {
      return Response.json(
        { error: "Cannot change your own role" },
        { status: 422 },
      );
    }

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    const { data: target, error: fetchError } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", targetId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return Response.json({ error: "Failed to load user" }, { status: 500 });
    }
    if (!target) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { error } = await db
      .from("profiles")
      .update({ role: body.role })
      .eq("id", targetId);

    if (error) {
      return Response.json({ error: "Failed to update role" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "user.role_changed",
      actorId: auth.user.id,
      entityId: targetId,
      entityType: "profile",
      metadata: { from: target.role, to: body.role },
    });

    return Response.json({ role: body.role });
  });
}
