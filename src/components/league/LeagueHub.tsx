import { notFound } from "next/navigation";

import { RaceCountdown } from "@/components/league/RaceCountdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { getHubStats, getLeagueBySlug } from "@/lib/ui/league-data";

interface LeagueHubProps {
  slug: string;
}

export function LeagueHub({ slug }: LeagueHubProps) {
  const league = getLeagueBySlug(slug);
  if (!league) {
    notFound();
  }

  const stats = getHubStats(league);

  return (
    <section className="theme-race-weekend">
      <div className="hero-band">
        <div
          aria-hidden="true"
          className="hero-band__media"
          style={{ backgroundImage: `url(${league.heroImage})` }}
        />
        <div className="hero-band__content">
          <StatusPill tone="red">{league.status}</StatusPill>
          <h1>{league.name}</h1>
          <p>
            Race control can now prepare the season foundation. Public data will
            appear here as results, penalties, and calendars are published.
          </p>
          <RaceCountdown targetIso={null} />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <section className="metric-tile" key={stat.label}>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
            </section>
          ))}
        </div>
        <EmptyState
          message="Race data will appear once sessions, results, penalties, and wheel history are published."
          title="No published race data yet"
        />
      </div>
    </section>
  );
}
