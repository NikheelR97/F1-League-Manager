import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { readServerEnv } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_ASSET_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALLOWED_KIND = new Set(["logo", "car_image"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId, teamId } = await params;
    const db = createSupabaseServiceRoleClient();

    // Verify team belongs to this league
    const { data: team } = await db
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("league_id", leagueId)
      .single();

    if (!team) {
      return Response.json({ error: "Team not found in this league" }, { status: 404 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    const kind = formData.get("kind");
    if (typeof kind !== "string" || !ALLOWED_KIND.has(kind)) {
      return Response.json({ error: "kind must be 'logo' or 'car_image'" }, { status: 422 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 422 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return Response.json({ error: "Only JPEG, PNG, and WebP images are allowed" }, { status: 422 });
    }

    if (file.size > MAX_ASSET_BYTES) {
      return Response.json({ error: "File must be 5 MB or smaller" }, { status: 413 });
    }

    const ext = MIME_TO_EXT[file.type];
    const storagePath = `leagues/${leagueId}/teams/${teamId}/${kind}.${ext}`;
    const { SUPABASE_STORAGE_ASSET_BUCKET: bucket } = readServerEnv();

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return Response.json({ error: "Upload failed" }, { status: 500 });
    }

    const column = kind === "logo" ? "logo_path" : "car_image_path";
    const { error: updateError } = await db
      .from("teams")
      .update({ [column]: storagePath })
      .eq("id", teamId);

    if (updateError) {
      return Response.json({ error: "Upload succeeded but failed to update team record" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: `team.${kind}_uploaded`,
      actorId: auth.user.id,
      entityId: teamId,
      entityType: "team",
      metadata: { kind, league_id: leagueId, path: storagePath },
    });

    return Response.json({ path: storagePath }, { status: 200 });
  });
}
