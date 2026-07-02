import "server-only";

import { notFound } from "next/navigation";

import { LeagueHub } from "@/components/league/LeagueHub";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

interface LeaguePageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();
  const isWheelLeague = league.format === "standard";

  const [
    { data: nextRace },
    { data: latestSession },
    { data: topDrivers },
    { data: topConstructors },
    { data: penaltyAlerts },
    { data: latestWheelSpin },
    { count: wheelPoolRemaining },
  ] = await Promise.all([
    db
      .from("race_sessions")
      .select("id, name, scheduled_at, circuits(name, country)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("status", "scheduled")
      .order("scheduled_at")
      .limit(1)
      .maybeSingle(),
    db
      .from("race_sessions")
      .select("id, name, race_number, published_at, circuits(name)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("driver_standings")
      .select("position, previous_position, total_points, wins, drivers(id, display_name, racing_number), teams(id, name, color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("position")
      .limit(5),
    db
      .from("team_standings")
      .select("position, previous_position, total_points, wins, teams(id, name, color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("position")
      .limit(5),
    db
      .from("driver_penalty_totals")
      .select("driver_id, penalty_points, drivers(display_name)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("ban_threshold_reached", true)
      .order("penalty_points", { ascending: false })
      .limit(10),
    isWheelLeague
      ? db
          .from("wheel_spins")
          .select("id, confirmed_at, circuits(name, country)")
          .eq("league_id", league.id)
          .eq("season_id", league.season.id)
          .eq("status", "confirmed")
          .order("confirmed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isWheelLeague
      ? db
          .from("league_circuit_pools")
          .select("id", { count: "exact", head: true })
          .eq("league_id", league.id)
          .eq("is_available", true)
          .is("used_at", null)
      : Promise.resolve({ count: null }),
  ]);

  return (
    <LeagueHub
      latestSession={latestSession ?? null}
      latestWheelSpin={latestWheelSpin ?? null}
      league={league}
      nextRace={nextRace ?? null}
      penaltyAlerts={penaltyAlerts ?? []}
      topConstructors={topConstructors ?? []}
      topDrivers={topDrivers ?? []}
      wheelPoolRemaining={isWheelLeague ? (wheelPoolRemaining ?? 0) : null}
    />
  );
}
