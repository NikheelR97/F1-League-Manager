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

  const [
    { data: nextRace },
    { data: latestSession },
    { data: topDrivers },
    { data: topConstructors },
    { data: penaltyAlerts },
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
      .select("position, previous_position, total_points, wins, drivers(display_name, racing_number), teams(name, color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("position")
      .limit(5),
    db
      .from("team_standings")
      .select("position, previous_position, total_points, wins, teams(name, color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("position")
      .limit(5),
    db
      .from("driver_penalty_totals")
      .select("penalty_points, drivers(display_name)")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("ban_threshold_reached", true)
      .order("penalty_points", { ascending: false })
      .limit(10),
  ]);

  return (
    <LeagueHub
      latestSession={latestSession ?? null}
      league={league}
      nextRace={nextRace ?? null}
      penaltyAlerts={penaltyAlerts ?? []}
      topConstructors={topConstructors ?? []}
      topDrivers={topDrivers ?? []}
    />
  );
}
