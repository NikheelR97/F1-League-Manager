import "server-only";

import { notFound } from "next/navigation";
import { Dices } from "lucide-react";

import { ErrorState } from "@/components/ui/ErrorState";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const revalidate = 60;

export default async function LeagueWheelHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const { data: spins, error: spinsError } = await db
    .from("wheel_spins")
    .select(`
      id,
      status,
      created_at,
      confirmed_at,
      circuits (name, country),
      race_sessions (name, session_code)
    `)
    .eq("league_id", league.id)
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false });

  if (spinsError) {
    return <ErrorState message="Failed to load wheel history" />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-f1-border pb-4">
        <h1 className="flex items-center gap-3 text-3xl font-bold uppercase tracking-tight text-f1-white">
          <Dices className="text-f1-red" size={28} />
          Wheel History
        </h1>
        <p className="mt-2 text-sm text-f1-muted">
          {league.name} - {league.season.name}
        </p>
      </header>

      {!spins?.length ? (
        <p className="text-sm text-f1-muted">No wheel spins have been confirmed yet for this league.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spins.map((spin) => {
            const circuit = spin.circuits as unknown as { name: string; country: string } | null;
            const session = spin.race_sessions as unknown as { name: string; session_code: string } | null;

            return (
              <div key={spin.id} className="flex flex-col border border-f1-border bg-f1-dark p-6">
                <div className="mb-4">
                  <p className="mb-1 text-xs font-bold uppercase text-f1-muted">
                    {new Date(spin.confirmed_at ?? spin.created_at).toLocaleDateString()}
                  </p>
                  <h3 className="mb-1 text-xl font-bold text-f1-white">
                    {circuit?.name ?? "Unknown Circuit"}
                  </h3>
                  <p className="text-sm text-f1-muted">{circuit?.country}</p>
                </div>

                <div className="mt-auto space-y-3 border-t border-f1-border pt-4">
                  {session && (
                    <p className="text-sm text-f1-white">
                      <span className="mb-0.5 block text-xs font-bold uppercase text-f1-muted">Assigned to Race</span>
                      {session.name} <span className="ml-1 font-mono text-xs text-f1-muted">({session.session_code})</span>
                    </p>
                  )}
                  <p className="text-sm text-f1-white">
                    <span className="mb-0.5 block text-xs font-bold uppercase text-f1-muted">Status</span>
                    Confirmed
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
