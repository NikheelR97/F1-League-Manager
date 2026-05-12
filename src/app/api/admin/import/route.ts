import "server-only";

import crypto from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { writeAdminAuditLog, withAdminGuard } from "@/lib/admin/api-guard";
import { MAX_WORKBOOK_BYTES } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { buildDiff } from "@/lib/import/diff";
import { fetchComputedStandings, runImport } from "@/lib/import/import-service";
import { parseWorkbook } from "@/lib/import/workbook-parser";

const bodySchema = z.object({
  league_id: z.string().uuid("Invalid league id"),
  season_id: z.string().uuid("Invalid season id"),
});

export async function POST(req: NextRequest): Promise<Response> {
  return withAdminGuard(
    req,
    async (req, auth) => {
      // 1. Parse multipart form data
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return Response.json({ error: "Invalid form data" }, { status: 400 });
      }

      const file = formData.get("file");
      const parsed = bodySchema.safeParse({
        league_id: formData.get("league_id"),
        season_id: formData.get("season_id"),
      });
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid parameters" },
          { status: 400 },
        );
      }
      const { league_id: leagueId, season_id: seasonId } = parsed.data;

      // 2. Validate file presence and type
      if (!(file instanceof File)) {
        return Response.json({ error: "File is required" }, { status: 400 });
      }
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        return Response.json(
          { error: "Only .xlsx files are accepted" },
          { status: 415 },
        );
      }

      // 3. Validate file size (belt-and-suspenders — guard already checked Content-Length)
      if (file.size > MAX_WORKBOOK_BYTES) {
        return Response.json({ error: "Workbook exceeds maximum size" }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

      const db = createSupabaseServiceRoleClient();

      // 4. Lock check: reject if a confirmed migration already exists for this season
      const { data: confirmed } = await db
        .from("workbook_migrations")
        .select("id")
        .eq("league_id", leagueId)
        .eq("season_id", seasonId)
        .eq("status", "confirmed")
        .maybeSingle();
      if (confirmed) {
        return Response.json(
          { error: "This season has already been confirmed and is locked against re-import" },
          { status: 409 },
        );
      }

      // 5. Parse workbook (never trust workbook formula cells — values only)
      const parseResult = parseWorkbook(buffer);
      if (!parseResult.ok) {
        return Response.json({ error: parseResult.error }, { status: 422 });
      }

      // 6. Run import (write teams, drivers, sessions, results to DB)
      const importResult = await runImport(parseResult.data, leagueId, seasonId, auth.user.id);
      if (!importResult.ok) {
        return Response.json({ error: importResult.error }, { status: 422 });
      }

      // 7. Build diff between computed standings and workbook standings
      const computed = await fetchComputedStandings(leagueId, seasonId);
      const diff = buildDiff(parseResult.data, computed);

      // 8. Upsert workbook_migration record (draft — hash prevents exact duplicates)
      const { data: migration, error: migErr } = await db
        .from("workbook_migrations")
        .upsert(
          {
            league_id: leagueId,
            season_id: seasonId,
            source_file_name: file.name,
            source_file_hash: fileHash,
            status: "draft",
            imported_by: auth.user.id,
          },
          { onConflict: "league_id,season_id,source_file_hash" },
        )
        .select("id")
        .single();

      if (migErr || !migration) {
        return Response.json({ error: "Failed to record migration" }, { status: 500 });
      }

      // 9. Audit log — metadata bounded and never contains raw workbook rows
      await writeAdminAuditLog({
        action: "import.uploaded",
        actorId: auth.user.id,
        entityId: migration.id,
        entityType: "workbook_migration",
        metadata: {
          league_id: leagueId,
          season_id: seasonId,
          file_name: file.name,
          session_count: importResult.sessionCount,
          driver_count: importResult.driverCount,
          diff_clean: diff.clean,
        },
      });

      // 10. Return sanitised response — raw workbook rows must NOT reach the browser
      return Response.json({
        migration_id: migration.id,
        diff,
        clean: diff.clean,
      });
    },
    { maxBodyBytes: MAX_WORKBOOK_BYTES },
  );
}
