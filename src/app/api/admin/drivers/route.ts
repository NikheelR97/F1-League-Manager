import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_DRIVERS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const createDriverSchema = z.object({
  country: z.string().trim().min(2).max(80).nullable().optional(),
  display_name: z.string().trim().min(1).max(80),
  profile_id: z.string().uuid().nullable().optional(),
  racing_number: z.number().int().min(1).max(999).nullable().optional(),
});

export async function GET(req: NextRequest) {
  return withAdminGuard(req, async () => {
    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("drivers")
      .select("id, display_name, racing_number, country, is_active")
      .order("display_name")
      .limit(MAX_DRIVERS_LIST);

    if (error) return Response.json({ error: "Failed to load drivers" }, { status: 500 });
    return Response.json({ drivers: data });
  }, { skipCsrf: true });
}

export async function POST(req: NextRequest) {
  return withAdminGuard(req, async (_req, auth) => {
    const body = await req.json();
    const parsed = createDriverSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("drivers")
      .insert(parsed.data)
      .select("id, display_name, racing_number, country, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "A driver with that racing number already exists" }, { status: 409 });
      }
      return Response.json({ error: "Failed to create driver" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "driver.created",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "driver",
      metadata: { display_name: parsed.data.display_name },
    });

    return Response.json({ driver: data }, { status: 201 });
  });
}
