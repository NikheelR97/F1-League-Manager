import { revalidateTag } from "next/cache";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { cacheTag } from "@/lib/cache/tags";
import { withAdminGuard, writeAdminAuditLog } from "@/lib/admin/api-guard";
import { MAX_PRIMARY_DRIVERS_PER_TEAM } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const transferSchema = z.object({
  driver_entry_id: z.string().uuid(),
  effective_date: z.string().date(),
  // new_team_id = null means the driver becomes a free agent (stays on the
  // league roster). B5 — this used to also remove them from the league;
  // that's now opt-in via remove_from_league.
  new_team_id: z.string().uuid().nullable(),
  // Only meaningful when new_team_id is null — closes the league_driver_entries
  // row (left_on) in addition to closing the team stint.
  remove_from_league: z.boolean().optional().default(false),
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

    const { driver_entry_id, effective_date, new_team_id, remove_from_league, transfer_reason } =
      parsed.data;
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

    // Find the current active team stint. A driver can have none — they may
    // already be a free agent (B5 rejoin path): still on the roster, just
    // between teams. In that case there's nothing to close, only a new stint
    // to open (or, if also leaving the league, nothing left to do to stints).
    const { data: currentStint, error: currentStintError } = await db
      .from("driver_team_stints")
      .select("id, team_id, starts_on")
      .eq("league_driver_entry_id", driver_entry_id)
      .is("ends_on", null)
      .maybeSingle();

    if (currentStintError) {
      return Response.json({ error: "Failed to load current team stint" }, { status: 500 });
    }

    if (!currentStint && !new_team_id && !remove_from_league) {
      return Response.json(
        { error: "Driver is already a free agent — select a new team or remove them from the league" },
        { status: 422 },
      );
    }

    if (currentStint && effective_date < currentStint.starts_on) {
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

    // Close current stint, if one exists — old race results retain the team
    // recorded at race time (never touched). A free agent rejoining a team
    // (no currentStint) skips straight to opening the new stint.
    if (currentStint) {
      const { error: closeError } = await db
        .from("driver_team_stints")
        .update({ ends_on: effective_date, transfer_reason: transfer_reason ?? null })
        .eq("id", currentStint.id);

      if (closeError) {
        return Response.json({ error: "Failed to close current team stint" }, { status: 500 });
      }
    }

    const rollbackStintClose = async () => {
      if (!currentStint) return null;
      const { error } = await db
        .from("driver_team_stints")
        .update({ ends_on: null, transfer_reason: null })
        .eq("id", currentStint.id);
      return error;
    };

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
        // F2: unique violation on driver_team_stints_one_open_per_entry means
        // a concurrent identical request already closed this same stint and
        // opened its own new one — we lost the race. Do NOT roll back the
        // close: that close is correct and already stands for the winner.
        // Reopening it here would leave TWO open stints (the reopened old
        // one + the winner's new one) — exactly the bug this index exists to
        // prevent. Report the conflict and stop; no audit log for the loser.
        if (stintError.code === "23505") {
          return Response.json(
            { error: "This driver was just transferred — refresh to see the current team" },
            { status: 409 },
          );
        }

        const rollbackError = await rollbackStintClose();
        if (rollbackError) {
          return Response.json({ error: "Transfer failed and rollback failed" }, { status: 500 });
        }

        return Response.json({ error: "Failed to open new team stint" }, { status: 500 });
      }
    } else if (remove_from_league) {
      // Driver is leaving the league entirely (opt-in — B5)
      const { error: leaveError } = await db
        .from("league_driver_entries")
        .update({ left_on: effective_date })
        .eq("id", driver_entry_id);

      if (leaveError) {
        const rollbackError = await rollbackStintClose();
        if (rollbackError) {
          return Response.json({ error: "Departure failed and rollback failed" }, { status: 500 });
        }

        return Response.json({ error: "Failed to mark driver as departed" }, { status: 500 });
      }
    }
    // else: blank team + no remove_from_league — driver simply becomes a free
    // agent, stint already closed above, roster entry untouched.

    const action = new_team_id
      ? "driver.transferred"
      : remove_from_league
        ? "driver.left_league"
        : "driver.departed";

    await writeAdminAuditLog({
      action,
      actorId: auth.user.id,
      entityId: driver_entry_id,
      entityType: "league_driver_entry",
      metadata: {
        effective_date,
        from_team_id: currentStint?.team_id ?? null,
        league_id: leagueId,
        to_team_id: new_team_id,
      },
    });

    revalidateTag(cacheTag.standings(leagueId), "default");
    revalidateTag(cacheTag.league(leagueId), "default");

    return Response.json({ ok: true }, { status: 200 });
  });
}
