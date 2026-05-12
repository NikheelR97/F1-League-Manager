import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CarryOverForm } from "@/components/admin/CarryOverForm";
import { SeasonActions } from "@/components/admin/SeasonActions";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { MAX_LEAGUES_LIST, MAX_SEASONS_LIST } from "@/lib/constants";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createSupabaseServiceRoleClient();

  const [
    { data: season, error: seasonError },
    { data: allSeasons, error: seasonsError },
    { data: leaguesData, error: leaguesError },
  ] = await Promise.all([
    db
      .from("seasons")
      .select("id, name, starts_on, ends_on, is_current, is_archived")
      .eq("id", id)
      .single(),
    db
      .from("seasons")
      .select("id, name")
      .order("starts_on", { ascending: false })
      .limit(MAX_SEASONS_LIST),
    db
      .from("leagues")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(MAX_LEAGUES_LIST),
  ]);

  if (seasonError && seasonError.code !== "PGRST116") {
    return <ErrorState message="Failed to load season." />;
  }
  if (!season) notFound();
  if (seasonsError || leaguesError) return <ErrorState message="Failed to load seasons list." />;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`${season.starts_on}${season.ends_on ? ` → ${season.ends_on}` : " → ongoing"}`}
        title={season.name}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-f1-muted">Status</h2>
          <div className="flex flex-wrap gap-2">
            {season.is_current && (
              <span className="border border-f1-red px-2 py-0.5 text-xs font-bold uppercase text-f1-red">
                Current
              </span>
            )}
            {season.is_archived && (
              <span className="border border-f1-border px-2 py-0.5 text-xs font-bold uppercase text-f1-muted">
                Archived
              </span>
            )}
            {!season.is_current && !season.is_archived && (
              <span className="border border-f1-border px-2 py-0.5 text-xs font-bold uppercase text-f1-muted">
                Inactive
              </span>
            )}
          </div>
          <SeasonActions
            isArchived={season.is_archived}
            isCurrent={season.is_current}
            seasonId={season.id}
          />
        </section>

        {leaguesData && leaguesData.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase text-f1-muted">
              Carry-Over Penalties &amp; Bans
            </h2>
            <p className="text-xs text-f1-muted">
              Select a league and source season to carry over penalty points and
              unserved bans for all drivers into this season.
            </p>
            {leaguesData.map((league) => (
              <div
                className="border border-f1-border bg-f1-black p-4 space-y-3"
                key={league.id}
              >
                <p className="text-sm font-bold text-f1-white">{league.name}</p>
                <CarryOverForm
                  currentSeasonId={season.id}
                  leagueId={league.id}
                  seasons={allSeasons ?? []}
                />
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
