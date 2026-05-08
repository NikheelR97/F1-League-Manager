import "server-only";

import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PublicPageHeader } from "@/components/league/PublicPageHeader";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

// Status display labels for public consumption
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  served: "Served",
  appealed: "Under Appeal",
  rescinded: "Rescinded",
};

export default async function PenaltiesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const [{ data: rows }, { data: lastSession }] = await Promise.all([
    // HANDOVER §8.4 and §13: steward_notes and appeal_notes must NOT be exposed publicly.
    // Select only public-safe fields.
    db
      .from("penalties")
      .select(
        "id, penalty_points, reason, status, created_at, drivers(id, display_name), race_sessions(name)",
      )
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("race_sessions")
      .select("name, published_at")
      .eq("league_id", league.id)
      .eq("season_id", league.season.id)
      .eq("status", "completed")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const penalties = rows ?? [];

  type Driver = { id: string; display_name: string };
  type RaceSession = { name: string };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PublicPageHeader
        format={league.format}
        lastRound={lastSession?.name ?? null}
        leagueName={league.name}
        seasonName={league.season.name}
        title="Penalties"
        updatedAt={penalties[0]?.created_at ?? null}
      />

      {penalties.length === 0 ? (
        <EmptyState message="No penalties have been issued this season." title="No penalties" />
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-f1-border text-left text-xs font-bold uppercase text-f1-muted">
                <th className="pb-2 pr-4">Driver</th>
                <th className="pb-2 pr-4">Race</th>
                <th className="pb-2 pr-4">Reason</th>
                <th className="pb-2 pr-4 text-right">Pts</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {penalties.map((p) => {
                const driver = p.drivers as unknown as Driver | null;
                const race = p.race_sessions as unknown as RaceSession | null;
                return (
                  <tr key={p.id} className="border-b border-f1-border/40 hover:bg-f1-dark">
                    <td className="py-2 pr-4 font-bold text-f1-white">{driver?.display_name ?? "—"}</td>
                    <td className="py-2 pr-4 text-f1-muted">{race?.name ?? "—"}</td>
                    <td className="py-2 pr-4 text-f1-muted">{p.reason}</td>
                    <td className="py-2 pr-4 text-right font-mono font-bold text-f1-red">{p.penalty_points}</td>
                    <td className="py-2 text-right font-mono text-xs text-f1-muted">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {penalties.map((p) => {
              const driver = p.drivers as unknown as Driver | null;
              const race = p.race_sessions as unknown as RaceSession | null;
              return (
                <li key={p.id} className="border border-f1-border bg-f1-dark p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-f1-white">{driver?.display_name ?? "—"}</p>
                      <p className="text-xs text-f1-muted">{race?.name ?? "—"}</p>
                      <p className="mt-1 text-xs text-f1-muted">{p.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-f1-red">{p.penalty_points} pts</p>
                      <p className="font-mono text-xs text-f1-muted">{STATUS_LABEL[p.status] ?? p.status}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
