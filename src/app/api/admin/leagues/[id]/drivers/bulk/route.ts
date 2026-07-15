import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import {
  MAX_DRIVERS_LIST,
  MAX_DRIVERS_PER_SEASON,
  MAX_PRIMARY_DRIVERS_PER_TEAM,
  MAX_TEAMS_PER_LEAGUE,
} from "@/lib/constants";
import { planBulkEnroll } from "@/lib/drivers/plan-bulk-enroll";
import { getCurrentSeason } from "@/lib/leagues/get-current-season";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const bulkDriverRowSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  racing_number: z.number().int().min(1).max(999).nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
  is_reserve: z.boolean().default(false),
});

const bulkEnrollSchema = z.object({
  drivers: z.array(bulkDriverRowSchema).min(1).max(MAX_DRIVERS_PER_SEASON),
});

// Bulk-create + enroll a roster of custom drivers into a league in one
// request. Dedupe/cap logic lives in planBulkEnroll (pure, unit-tested);
// this handler just loads state, plans, and writes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: leagueId } = await params;
    const body = await req.json();
    const parsed = bulkEnrollSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const db = createSupabaseServiceRoleClient();

    const currentSeason = await getCurrentSeason(db, leagueId);
    if (!currentSeason) {
      return Response.json(
        { error: "League has no current season — create one first." },
        { status: 409 },
      );
    }

    const [{ data: teams, error: teamsError }, { data: activeEntries, error: entriesError }] =
      await Promise.all([
        db
          .from("teams")
          .select("id, name")
          .eq("league_id", leagueId)
          .limit(MAX_TEAMS_PER_LEAGUE),
        db
          .from("league_driver_entries")
          .select("is_reserve, drivers(display_name), driver_team_stints(team_id, ends_on)")
          .eq("league_id", leagueId)
          .is("left_on", null)
          .limit(MAX_DRIVERS_LIST),
      ]);

    if (teamsError || entriesError) {
      return Response.json({ error: "Failed to load league state" }, { status: 500 });
    }

    const teamIds = new Set((teams ?? []).map((t) => t.id));
    const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));

    const invalidTeamRow = parsed.data.drivers.find(
      (row) => row.team_id != null && !teamIds.has(row.team_id),
    );
    if (invalidTeamRow) {
      return Response.json(
        { error: `Team ${invalidTeamRow.team_id} is not part of this league` },
        { status: 422 },
      );
    }

    type ActiveEntryRow = {
      is_reserve: boolean;
      drivers: { display_name: string } | null;
      driver_team_stints: Array<{ team_id: string; ends_on: string | null }> | null;
    };
    const rows = (activeEntries ?? []) as unknown as ActiveEntryRow[];

    const enrolledNamesLower = new Set(
      rows
        .map((e) => e.drivers?.display_name?.toLowerCase())
        .filter((n): n is string => !!n),
    );

    const existingPrimaryCountByTeam = new Map<string, number>();
    for (const entry of rows) {
      if (entry.is_reserve) continue;
      for (const stint of entry.driver_team_stints ?? []) {
        if (stint.ends_on !== null) continue;
        existingPrimaryCountByTeam.set(
          stint.team_id,
          (existingPrimaryCountByTeam.get(stint.team_id) ?? 0) + 1,
        );
      }
    }

    const plan = planBulkEnroll({
      rows: parsed.data.drivers.map((row) => ({
        display_name: row.display_name,
        racing_number: row.racing_number ?? null,
        team_id: row.team_id ?? null,
        is_reserve: row.is_reserve,
      })),
      enrolledNamesLower,
      existingPrimaryCountByTeam,
      teamNameById,
      maxPrimaryPerTeam: MAX_PRIMARY_DRIVERS_PER_TEAM,
    });

    if (plan.teamOverflows.length > 0) {
      const details = plan.teamOverflows
        .map((o) => `${o.team_name} (${o.attempted}/${o.cap})`)
        .join(", ");
      return Response.json(
        { error: `Primary driver cap exceeded for: ${details}` },
        { status: 422 },
      );
    }

    if (plan.toEnroll.length === 0) {
      return Response.json({
        added: 0,
        skipped: plan.skippedAlreadyEnrolled.length + plan.duplicateInBatch.length,
      });
    }

    const { data: existingDrivers, error: existingDriversError } = await db
      .from("drivers")
      .select("id, display_name")
      .limit(MAX_DRIVERS_LIST);

    if (existingDriversError) {
      return Response.json({ error: "Failed to load drivers" }, { status: 500 });
    }

    const driverByName = new Map(
      (existingDrivers ?? []).map((d) => [d.display_name.toLowerCase(), d.id]),
    );

    const joinedOn = new Date().toISOString().slice(0, 10);

    for (const row of plan.toEnroll) {
      const nameLower = row.display_name.toLowerCase();
      let driverId = driverByName.get(nameLower);

      if (!driverId) {
        const { data: newDriver, error: driverError } = await db
          .from("drivers")
          .insert({
            display_name: row.display_name,
            racing_number: row.racing_number,
            is_active: true,
          })
          .select("id")
          .single();

        if (driverError || !newDriver) {
          return Response.json({ error: "Failed to create driver" }, { status: 500 });
        }
        driverId = newDriver.id;
        driverByName.set(nameLower, driverId);
      }

      const { data: entry, error: entryError } = await db
        .from("league_driver_entries")
        .upsert(
          {
            league_id: leagueId,
            season_id: currentSeason.id,
            driver_id: driverId,
            is_reserve: row.is_reserve,
            joined_on: joinedOn,
          },
          { onConflict: "league_id,season_id,driver_id" },
        )
        .select("id")
        .single();

      if (entryError || !entry) {
        return Response.json({ error: "Failed to enroll driver" }, { status: 500 });
      }

      if (row.team_id) {
        const { error: stintError } = await db.from("driver_team_stints").insert({
          league_driver_entry_id: entry.id,
          team_id: row.team_id,
          starts_on: joinedOn,
        });

        if (stintError) {
          return Response.json({ error: "Failed to assign team" }, { status: 500 });
        }
      }
    }

    await writeAdminAuditLog({
      action: "league_drivers.bulk_added",
      actorId: auth.user.id,
      entityId: leagueId,
      entityType: "league_driver_entry",
      metadata: { league_id: leagueId, count: plan.toEnroll.length },
    });

    return Response.json(
      {
        added: plan.toEnroll.length,
        skipped: plan.skippedAlreadyEnrolled.length + plan.duplicateInBatch.length,
      },
      { status: 201 },
    );
  });
}
