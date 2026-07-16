import { type NextRequest } from "next/server";

import { withRacerGuard } from "@/lib/racer/api-guard";
import { buildDuplicateName } from "@/lib/racer/setup-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// POST /api/racer/setups/[id]/duplicate — create an exact copy of a setup
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRacerGuard(req, async (_req, { userId }) => {
    const { id: setupId } = await params;
    const db = createSupabaseServiceRoleClient();

    // Fetch source setup and verify ownership
    const { data: source, error: fetchError } = await db
      .from("vehicle_setups")
      .select(
        "id, driver_id, circuit_id, name, game_version, weather, is_public, league_id, setup_data, drivers!inner(profile_id)",
      )
      .eq("id", setupId)
      .single();

    if (fetchError || !source) {
      return Response.json({ error: "Setup not found" }, { status: 404 });
    }

    const driver = source.drivers as unknown as { profile_id: string | null };
    if (driver.profile_id !== userId) {
      return Response.json({ error: "Setup not found" }, { status: 404 });
    }

    const { data, error } = await db
      .from("vehicle_setups")
      .insert({
        driver_id: source.driver_id,
        circuit_id: source.circuit_id,
        name: buildDuplicateName(source.name),
        game_version: source.game_version,
        weather: source.weather,
        is_public: false,
        league_id: source.league_id,
        setup_data: source.setup_data as Record<string, unknown>,
      })
      .select("id, name, circuit_id, driver_id")
      .single();

    if (error) {
      return Response.json({ error: "Failed to duplicate setup" }, { status: 500 });
    }

    return Response.json({ setup: data }, { status: 201 });
  });
}
