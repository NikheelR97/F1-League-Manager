import { LeagueCard } from "@/components/league/LeagueCard";
import { PublicShell } from "@/components/layout/PublicShell";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { getLeagueSummaries } from "@/lib/ui/league-data";

export default function Home() {
  const leagues = getLeagueSummaries();

  return (
    <PublicShell>
      <section className="surface-band">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <TeamBadge color="#E8002D" label="Race Weekend" />
            <h1 className="mt-5 text-4xl font-black uppercase text-f1-white sm:text-6xl">
              F1 Esports League Manager
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-f1-silver">
              League race hubs bring calendar readiness, standings status,
              penalties, and wheel state into one race-weekend view.
            </p>
          </div>
          <div className="grid gap-6">
            {leagues.map((league) => (
              <LeagueCard key={league.slug} league={league} />
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
