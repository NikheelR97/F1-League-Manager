import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { LEAGUE_ASSETS_BUCKET, MAX_ASSET_UPLOAD_BYTES } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALLOWED_KIND = new Set(["logo", "hero_image"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const { data: league, error: leagueError } = await db
      .from("leagues")
      .select("id")
      .eq("id", leagueId)
      .single();

    if (leagueError && leagueError.code !== "PGRST116") {
      return Response.json({ error: "Failed to load league" }, { status: 500 });
    }

    if (!league) {
      return Response.json({ error: "League not found" }, { status: 404 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    const kind = formData.get("kind");
    if (typeof kind !== "string" || !ALLOWED_KIND.has(kind)) {
      return Response.json({ error: "kind must be 'logo' or 'hero_image'" }, { status: 422 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 422 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return Response.json({ error: "Only JPEG, PNG, and WebP images are allowed" }, { status: 422 });
    }

    if (file.size > MAX_ASSET_UPLOAD_BYTES) {
      return Response.json({ error: "File must be 5 MB or smaller" }, { status: 413 });
    }

    const ext = MIME_TO_EXT[file.type];
    const storagePath = `leagues/${leagueId}/${kind}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await db.storage
      .from(LEAGUE_ASSETS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return Response.json({ error: "Upload failed" }, { status: 500 });
    }

    const column = kind === "logo" ? "logo_path" : "hero_image_path";
    const { error: updateError } = await db
      .from("leagues")
      .update({ [column]: storagePath })
      .eq("id", leagueId);

    if (updateError) {
      const { error: removeError } = await db.storage
        .from(LEAGUE_ASSETS_BUCKET)
        .remove([storagePath]);

      if (removeError) {
        return Response.json({ error: "Upload record update failed and cleanup failed" }, { status: 500 });
      }

      return Response.json({ error: "Upload succeeded but failed to update league record" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: `league.${kind}_uploaded`,
      actorId: auth.user.id,
      entityId: leagueId,
      entityType: "league",
      metadata: { kind, path: storagePath },
    });

    return Response.json({ path: storagePath }, { status: 200 });
  });
}
