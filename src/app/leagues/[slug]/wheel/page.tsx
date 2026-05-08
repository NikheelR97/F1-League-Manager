import "server-only";

import { notFound } from "next/navigation";
import { Dices } from "lucide-react";

import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const revalidate = 60;

export default async function LeagueWheelHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = createSupabaseServiceRoleClient();

  const { data: league, error: leagueError } = await db
    .from("leagues")
    .select("id, name, seasons(name)")
    .eq("slug", slug)
    .single();

  if (leagueError) return <ErrorState message="League not found" />;
  if (!league) notFound();

  const { data: spins, error: spinsError } = await db
    .from("wheel_spins")
    .select(`
      id,
      status,
      created_at,
      confirmed_at,
      circuits (name, country),
      race_sessions (name, session_code),
      spun_by:profiles!wheel_spins_spun_by_fkey (display_name),
      confirmed_by:profiles!wheel_spins_confirmed_by_fkey (display_name)
    `)
    .eq("league_id", league.id)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false });

  if (spinsError) {
    return <ErrorState message="Failed to load wheel history" />;
  }

  const seasonName = (league.seasons as unknown as { name: string } | null)?.name ?? "Current Season";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-f1-border pb-4">
        <h1 className="text-3xl font-bold uppercase tracking-tight text-f1-white flex items-center gap-3">
          <Dices className="text-f1-red" size={28} />
          Wheel History
        </h1>
        <p className="mt-2 text-sm text-f1-muted">
          {league.name} · {seasonName}
        </p>
      </header>

      {!spins?.length ? (
        <p className="text-sm text-f1-muted">No wheel spins have been confirmed yet for this league.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spins.map((spin) => {
            const circuit = spin.circuits as unknown as { name: string; country: string } | null;
            const session = spin.race_sessions as unknown as { name: string; session_code: string } | null;
            const spinner = spin.spun_by as unknown as { display_name: string } | null;
            const confirmer = spin.confirmed_by as unknown as { display_name: string } | null;

            return (
              <div key={spin.id} className="border border-f1-border bg-f1-dark p-6 flex flex-col">
                <div className="mb-4">
                  <p className="text-xs uppercase font-bold text-f1-muted mb-1">
                    {new Date(spin.confirmed_at ?? spin.created_at).toLocaleDateString()}
                  </p>
                  <h3 className="text-xl font-bold text-f1-white mb-1">
                    {circuit?.name ?? "Unknown Circuit"}
                  </h3>
                  <p className="text-sm text-f1-muted">{circuit?.country}</p>
                </div>
                
                <div className="mt-auto space-y-3 pt-4 border-t border-f1-border">
                  {session && (
                    <p className="text-sm text-f1-white">
                      <span className="text-f1-muted uppercase text-xs font-bold block mb-0.5">Assigned to Race</span>
                      {session.name} <span className="font-mono text-xs text-f1-muted ml-1">({session.session_code})</span>
                    </p>
                  )}
                  <p className="text-sm text-f1-white">
                    <span className="text-f1-muted uppercase text-xs font-bold block mb-0.5">Confirmed By</span>
                    {confirmer?.display_name ?? spinner?.display_name ?? "Admin"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
