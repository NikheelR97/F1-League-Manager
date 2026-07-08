import "server-only";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { writeAdminAuditLog, withAdminGuard } from "@/lib/admin/api-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const bodySchema = z.object({
  migration_id: z.string().uuid("Invalid migration id"),
});

export async function POST(req: NextRequest): Promise<Response> {
  return withAdminGuard(req, async (req, auth) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid parameters" },
        { status: 400 },
      );
    }

    const { migration_id: migrationId } = parsed.data;
    const db = createSupabaseServiceRoleClient();

    // Load migration — confirm it is in draft status
    const { data: migration } = await db
      .from("workbook_migrations")
      .select("id, league_id, season_id, status")
      .eq("id", migrationId)
      .maybeSingle();

    if (!migration) {
      return Response.json({ error: "Migration not found" }, { status: 404 });
    }
    if (migration.status === "confirmed") {
      return Response.json({ error: "Migration is already confirmed" }, { status: 409 });
    }
    if (migration.status === "void") {
      return Response.json({ error: "Migration has been voided" }, { status: 409 });
    }

    // Lock: set confirmed + confirmed_by
    const { error: updateErr } = await db
      .from("workbook_migrations")
      .update({
        status: "confirmed",
        confirmed_by: auth.user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", migrationId)
      .eq("status", "draft");

    if (updateErr) {
      return Response.json({ error: "Failed to confirm migration" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "import.confirmed",
      actorId: auth.user.id,
      entityId: migrationId,
      entityType: "workbook_migration",
      metadata: {
        league_id: migration.league_id,
        season_id: migration.season_id,
      },
    });

    return Response.json({ ok: true });
  });
}
