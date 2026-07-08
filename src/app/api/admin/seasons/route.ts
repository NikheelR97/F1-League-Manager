import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_SEASONS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const createSeasonSchema = z.object({
  ends_on: z.string().date().nullable(),
  name: z.string().trim().min(1).max(80),
  starts_on: z.string().date(),
}).refine(
  (d) => !d.ends_on || d.ends_on >= d.starts_on,
  { message: "ends_on must be on or after starts_on" },
);

export async function GET(req: NextRequest) {
  return withAdminGuard(req, async () => {
    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("seasons")
      .select("id, name, starts_on, ends_on, is_current")
      .order("starts_on", { ascending: false })
      .limit(MAX_SEASONS_LIST);

    if (error) return Response.json({ error: "Failed to load seasons" }, { status: 500 });
    return Response.json({ seasons: data });
  }, { skipCsrf: true });
}

export async function POST(req: NextRequest) {
  return withAdminGuard(req, async (_req, auth) => {
    const body = await req.json();
    const parsed = createSeasonSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("seasons")
      .insert(parsed.data)
      .select("id, name, starts_on, ends_on, is_current")
      .single();

    if (error) return Response.json({ error: "Failed to create season" }, { status: 500 });

    await writeAdminAuditLog({
      action: "season.created",
      actorId: auth.user.id,
      entityId: data.id,
      entityType: "season",
      metadata: { name: parsed.data.name },
    });

    return Response.json({ season: data }, { status: 201 });
  });
}
