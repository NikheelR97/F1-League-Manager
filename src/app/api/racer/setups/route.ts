import { type NextRequest } from "next/server";
import { z } from "zod";

import { MAX_SETUPS_LIST } from "@/lib/constants";
import { withRacerGuard } from "@/lib/racer/api-guard";
import { createSetupSchema } from "@/lib/racer/setup-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// GET /api/racer/setups — list compact DTOs (no setup_data)
export async function GET(req: NextRequest) {
  return withRacerGuard(req, async (_req, { userId }) => {
    const db = createSupabaseServiceRoleClient();

    // Resolve all drivers linked to this user's profile
    const { data: drivers, error: driverError } = await db
      .from("drivers")
      .select("id")
      .eq("profile_id", userId);

    if (driverError) {
      return Response.json({ error: "Failed to resolve driver" }, { status: 500 });
    }
    if (!drivers || drivers.length === 0) {
      return Response.json({ setups: [] });
    }

    const driverIds = drivers.map((d) => d.id);

    // Parse optional filter params
    const url = new URL(req.url);
    const circuitId = url.searchParams.get("circuit_id");
    const gameVersion = url.searchParams.get("game_version");
    const weather = url.searchParams.get("weather");
    const leagueId = url.searchParams.get("league_id");

    let query = db
      .from("vehicle_setups")
      .select(
        "id, driver_id, circuit_id, name, game_version, weather, is_public, league_id, created_at, updated_at, circuits(name, country)",
      )
      .in("driver_id", driverIds)
      .order("updated_at", { ascending: false })
      .limit(MAX_SETUPS_LIST);

    if (circuitId) query = query.eq("circuit_id", circuitId);
    if (gameVersion) query = query.eq("game_version", gameVersion);
    if (weather) query = query.eq("weather", weather);
    if (leagueId) query = query.eq("league_id", leagueId);

    const { data: setups, error: setupError } = await query;
    if (setupError) {
      return Response.json({ error: "Failed to load setups" }, { status: 500 });
    }

    return Response.json({ setups: setups ?? [] });
  });
}

// POST /api/racer/setups — create a new setup
export async function POST(req: NextRequest) {
  return withRacerGuard(req, async (_req, { userId }) => {
    const db = createSupabaseServiceRoleClient();

    let body: z.infer<typeof createSetupSchema>;
    try {
      body = createSetupSchema.parse(await req.json());
    } catch (e) {
      if (e instanceof z.ZodError) {
        return Response.json({ error: e.flatten() }, { status: 422 });
      }
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    // Verify the driver belongs to the current user
    const { data: driver, error: driverError } = await db
      .from("drivers")
      .select("id")
      .eq("id", body.driver_id)
      .eq("profile_id", userId)
      .maybeSingle();

    if (driverError) {
      return Response.json({ error: "Failed to validate driver" }, { status: 500 });
    }
    if (!driver) {
      return Response.json({ error: "Driver not found or not owned by you" }, { status: 403 });
    }

    const { data, error } = await db
      .from("vehicle_setups")
      .insert({
        driver_id: body.driver_id,
        circuit_id: body.circuit_id,
        name: body.name,
        game_version: body.game_version ?? null,
        weather: body.weather ?? null,
        is_public: body.is_public,
        league_id: body.league_id ?? null,
        setup_data: body.setup_data,
      })
      .select("id, name, circuit_id, driver_id")
      .single();

    if (error) {
      return Response.json({ error: "Failed to create setup" }, { status: 500 });
    }

    return Response.json({ setup: data }, { status: 201 });
  });
}
