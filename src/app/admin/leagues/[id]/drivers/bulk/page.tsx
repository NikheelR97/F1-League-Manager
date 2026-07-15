import "server-only";

import { notFound } from "next/navigation";

import { AddDriversGrid } from "@/components/admin/AddDriversGrid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { MAX_TEAMS_PER_LEAGUE } from "@/lib/constants";
import { getCurrentSeason } from "@/lib/leagues/get-current-season";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function BulkAddDriversPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: league, error: leagueError },
    { data: teams, error: teamsError },
  ] = await Promise.all([
    db.from("leagues").select("id, name").eq("id", leagueId).single(),
    db
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId)
      .order("name")
      .limit(MAX_TEAMS_PER_LEAGUE),
  ]);

  if (leagueError && leagueError.code !== "PGRST116") {
    return <ErrorState message="Failed to load league." />;
  }

  if (teamsError) {
    return <ErrorState message="Failed to load teams." />;
  }

  if (!league) notFound();

  // Bulk API requires a current season; short-circuit if none exists
  let season;
  try {
    season = await getCurrentSeason(db, leagueId);
  } catch {
    return <ErrorState message="Failed to load season." />;
  }

  if (!season) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          description="Add multiple drivers at once"
          title="Add Drivers"
        />
        <p className="text-sm text-f1-muted">
          This league has no current season yet — create one before adding drivers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Add multiple drivers to ${league.name}`}
        title="Add Drivers"
      />
      <AddDriversGrid leagueId={leagueId} teams={teams ?? []} />
    </div>
  );
}
