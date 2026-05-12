import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { cacheTag } from "@/lib/cache/tags";
import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_PRIMARY_DRIVERS_PER_TEAM } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const transferSchema = z.object({
  // new_team_id = null means the driver is leaving the league entirely
  driver_entry_id: z.string().uuid(),
  effective_date: z.string().date(),
  new_team_id: z.string().uuid().nullable(),
  transfer_reason: z.string().trim().max(240).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const body = await req.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { driver_entry_id, effective_date, new_team_id, transfer_reason } = parsed.data;
    const db = createSupabaseServiceRoleClient();

    // Verify entry belongs to this league and is still active
    const { data: entry, error: entryError } = await db
      .from("league_driver_entries")
      .select("id, driver_id, is_reserve")
      .eq("id", driver_entry_id)
      .eq("league_id", leagueId)
      .is("left_on", null)
      .single();

    if (entryError && entryError.code !== "PGRST116") {
      return Response.json({ error: "Failed to load driver entry" }, { status: 500 });
    }

    if (!entry) {
      return Response.json({ error: "Driver entry not found or already inactive" }, { status: 404 });
    }

    // Find the current active team stint
    const { data: currentStint, error: currentStintError } = await db
      .from("driver_team_stints")
      .select("id, team_id, starts_on")
      .eq("league_driver_entry_id", driver_entry_id)
      .is("ends_on", null)
      .single();

    if (currentStintError && currentStintError.code !== "PGRST116") {
      return Response.json({ error: "Failed to load current team stint" }, { status: 500 });
    }

    if (!currentStint) {
      return Response.json({ error: "No active team stint found for this driver" }, { status: 404 });
    }

    if (effective_date < currentStint.starts_on) {
      return Response.json(
        { error: "Transfer date cannot be before current stint start date" },
        { status: 422 },
      );
    }

    if (new_team_id) {
      // Verify new team belongs to this league
      const { data: newTeam, error: newTeamError } = await db
        .from("teams")
        .select("id")
        .eq("id", new_team_id)
        .eq("league_id", leagueId)
        .single();

      if (newTeamError && newTeamError.code !== "PGRST116") {
        return Response.json({ error: "Failed to verify new team" }, { status: 500 });
      }

      if (!newTeam) {
        return Response.json({ error: "New team not found in this league" }, { status: 422 });
      }

      // Enforce primary driver limit on the destination team
      if (!entry.is_reserve) {
        const { data: activeStints, error: activeStintsError } = await db
          .from("driver_team_stints")
          .select("league_driver_entry_id")
          .eq("team_id", new_team_id)
          .is("ends_on", null);

        if (activeStintsError) {
          return Response.json({ error: "Failed to load destination team assignments" }, { status: 500 });
        }

        const activeEntryIds = activeStints.map((stint) => stint.league_driver_entry_id);
        if (activeEntryIds.length >= MAX_PRIMARY_DRIVERS_PER_TEAM) {
          const { count, error: countError } = await db
            .from("league_driver_entries")
            .select("id", { count: "exact", head: true })
            .eq("league_id", leagueId)
            .is("left_on", null)
            .eq("is_reserve", false)
            .neq("id", driver_entry_id)
            .in("id", activeEntryIds);

          if (countError) {
            return Response.json({ error: "Failed to count destination team drivers" }, { status: 500 });
          }

          if ((count ?? 0) >= MAX_PRIMARY_DRIVERS_PER_TEAM) {
            return Response.json(
              { error: `Destination team already has ${MAX_PRIMARY_DRIVERS_PER_TEAM} primary drivers` },
              { status: 422 },
            );
          }
        }
      }
    }

    // Close current stint — old race results retain the team recorded at race time (never touched)
    const { error: closeError } = await db
      .from("driver_team_stints")
      .update({ ends_on: effective_date, transfer_reason: transfer_reason ?? null })
      .eq("id", currentStint.id);

    if (closeError) {
      return Response.json({ error: "Failed to close current team stint" }, { status: 500 });
    }

    if (new_team_id) {
      // Open new stint on destination team
      const { error: stintError } = await db
        .from("driver_team_stints")
        .insert({
          league_driver_entry_id: driver_entry_id,
          starts_on: effective_date,
          team_id: new_team_id,
          transfer_reason: transfer_reason ?? null,
        });

      if (stintError) {
        const { error: rollbackError } = await db
          .from("driver_team_stints")
          .update({ ends_on: null, transfer_reason: null })
          .eq("id", currentStint.id);

        if (rollbackError) {
          return Response.json({ error: "Transfer failed and rollback failed" }, { status: 500 });
        }

        return Response.json({ error: "Failed to open new team stint" }, { status: 500 });
      }
    } else {
      // Driver is leaving the league
      const { error: leaveError } = await db
        .from("league_driver_entries")
        .update({ left_on: effective_date })
        .eq("id", driver_entry_id);

      if (leaveError) {
        const { error: rollbackError } = await db
          .from("driver_team_stints")
          .update({ ends_on: null, transfer_reason: null })
          .eq("id", currentStint.id);

        if (rollbackError) {
          return Response.json({ error: "Departure failed and rollback failed" }, { status: 500 });
        }

        return Response.json({ error: "Failed to mark driver as departed" }, { status: 500 });
      }
    }

    await writeAdminAuditLog({
      action: new_team_id ? "driver.transferred" : "driver.departed",
      actorId: auth.user.id,
      entityId: driver_entry_id,
      entityType: "league_driver_entry",
      metadata: {
        effective_date,
        from_team_id: currentStint.team_id,
        league_id: leagueId,
        to_team_id: new_team_id,
      },
    });

    revalidateTag(cacheTag.standings(leagueId), "default");
    revalidateTag(cacheTag.league(leagueId), "default");

    return Response.json({ ok: true }, { status: 200 });
  });
}
