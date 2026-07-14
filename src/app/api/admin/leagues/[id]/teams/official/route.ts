import { type NextRequest } from "next/server";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_TEAMS_PER_LEAGUE } from "@/lib/constants";
import { selectOfficialTeamsToAdd } from "@/lib/teams/select-official-teams";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Bulk-add every official F1 team template to a league in one request: skips
// templates already added and respects MAX_TEAMS_PER_LEAGUE. Beats looping the
// single-team POST client-side (N audit logs + N rate-limit hits).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const db = createSupabaseServiceRoleClient();

    const [{ data: templates, error: templatesError }, { data: existing, error: existingError }] =
      await Promise.all([
        db
          .from("official_team_templates")
          .select("id, name, slug, color_hex")
          .order("sort_order"),
        db
          .from("teams")
          .select("slug")
          .eq("league_id", leagueId)
          .limit(MAX_TEAMS_PER_LEAGUE),
      ]);

    if (templatesError || existingError) {
      return Response.json({ error: "Failed to load teams" }, { status: 500 });
    }

    const existingSlugs = new Set((existing ?? []).map((t) => t.slug));
    const toAdd = selectOfficialTeamsToAdd(
      templates ?? [],
      existingSlugs,
      existing?.length ?? 0,
      MAX_TEAMS_PER_LEAGUE,
    );

    if (toAdd.length === 0) {
      return Response.json({
        added: 0,
        message: "All official teams are already added (or the league is full).",
      });
    }

    const rows = toAdd.map((t) => ({
      color_hex: t.color_hex,
      kind: "official" as const,
      league_id: leagueId,
      name: t.name,
      official_template_id: t.id,
      slug: t.slug,
    }));

    const { data, error } = await db.from("teams").insert(rows).select("id");

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "Some official teams already exist" }, { status: 409 });
      }
      return Response.json({ error: "Failed to add official teams" }, { status: 500 });
    }

    await writeAdminAuditLog({
      action: "teams.bulk_created",
      actorId: auth.user.id,
      entityId: leagueId,
      entityType: "team",
      metadata: { count: data.length, league_id: leagueId, source: "official-all" },
    });

    return Response.json({ added: data.length }, { status: 201 });
  });
}
