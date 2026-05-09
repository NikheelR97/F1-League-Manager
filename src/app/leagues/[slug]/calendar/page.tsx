import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";

import { ErrorState } from "@/components/ui/ErrorState";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const revalidate = 60; // Revalidate every minute

export default async function LeagueCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const db = createSupabaseServiceRoleClient();

  const { data: sessions, error: sessionsError } = await db
    .from("race_sessions")
    .select("id, name, session_code, race_number, scheduled_at, status, circuits(name, country)")
    .eq("league_id", league.id)
    .order("scheduled_at", { ascending: true });

  if (sessionsError) return <ErrorState message="Failed to load calendar" />;

  const seasonName = league.season.name;

  const upcoming = sessions?.filter((s) => s.status !== "completed") ?? [];
  const completed = sessions?.filter((s) => s.status === "completed") ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-f1-border pb-4">
        <h1 className="text-3xl font-bold uppercase tracking-tight text-f1-white">
          Calendar
        </h1>
        <p className="mt-2 text-sm text-f1-muted">
          {league.name} · {seasonName}
        </p>
      </header>

      <div className="space-y-12">
        {/* Upcoming */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold uppercase text-f1-white">
            <Calendar className="text-f1-red" size={20} />
            Upcoming Races
          </h2>
          {!upcoming.length ? (
            <p className="text-sm text-f1-muted">No upcoming races scheduled.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((session) => {
                const circuit = session.circuits as unknown as { name: string; country: string } | null;
                return (
                  <div key={session.id} className="flex flex-col border border-f1-border bg-f1-dark hover:border-f1-red transition-colors">
                    <div className="border-b border-f1-border p-4 bg-black/20">
                      <p className="text-xs font-bold uppercase text-f1-red mb-1">
                        Race {session.race_number}
                      </p>
                      <h3 className="text-lg font-bold text-f1-white line-clamp-1">{session.name}</h3>
                      {circuit && (
                        <p className="text-sm text-f1-muted flex items-center gap-1 mt-1">
                          <MapPin size={14} />
                          {circuit.name}, {circuit.country}
                        </p>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="mb-4">
                        <p className="text-xs text-f1-muted uppercase font-bold">Scheduled Date</p>
                        <p className="text-f1-white text-lg">
                          {new Date(session.scheduled_at).toLocaleDateString(undefined, {
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-f1-muted">
                          {new Date(session.scheduled_at).toLocaleTimeString(undefined, {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-f1-border">
                        <span className="font-mono text-xs text-f1-muted">{session.session_code}</span>
                        <span className="border border-f1-muted px-2 py-0.5 text-[10px] font-bold uppercase text-f1-muted">
                          {session.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold uppercase text-f1-white">
              Completed Races
            </h2>
            <div className="overflow-hidden border border-f1-border bg-f1-dark">
              <table className="w-full text-left text-sm text-f1-white">
                <thead className="border-b border-f1-border bg-black/20 text-xs uppercase text-f1-muted">
                  <tr>
                    <th className="px-4 py-3 font-bold">Date</th>
                    <th className="px-4 py-3 font-bold">Race</th>
                    <th className="px-4 py-3 font-bold">Circuit</th>
                    <th className="px-4 py-3 font-bold text-right">Results</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-f1-border">
                  {completed.map((session) => {
                    const circuit = session.circuits as unknown as { name: string; country: string } | null;
                    return (
                      <tr key={session.id} className="transition-colors hover:bg-black/20">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(session.scheduled_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {session.name}
                        </td>
                        <td className="px-4 py-3 text-f1-muted">
                          {circuit ? `${circuit.name}, ${circuit.country}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/leagues/${slug}/results?session=${session.id}`}
                            className="text-xs font-bold uppercase text-f1-red hover:text-white transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
