import Image from "next/image";
import Link from "next/link";

import { RaceCountdown } from "@/components/league/RaceCountdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { PositionDelta } from "@/components/ui/PositionDelta";
import { StatusPill } from "@/components/ui/StatusPill";
import { LEAGUE_ASSETS_BUCKET } from "@/lib/constants";
import type { PublicLeague } from "@/lib/public/resolve-league";

interface NextRace {
  id: string;
  name: string;
  scheduled_at: string;
  circuits: unknown;
}

interface LatestSession {
  id: string;
  name: string;
  race_number: number;
  published_at: string | null;
  circuits: unknown;
}

interface TopDriver {
  position: number;
  previous_position: number | null;
  total_points: number;
  wins: number;
  drivers: unknown;
  teams: unknown;
}

interface TopConstructor {
  position: number;
  previous_position: number | null;
  total_points: number;
  wins: number;
  teams: unknown;
}

interface PenaltyAlert {
  driver_id: string;
  penalty_points: number;
  drivers: unknown;
}

interface LeagueHubProps {
  league: PublicLeague;
  nextRace: NextRace | null;
  latestSession: LatestSession | null;
  topDrivers: TopDriver[];
  topConstructors: TopConstructor[];
  penaltyAlerts: PenaltyAlert[];
}

function castCircuit(v: unknown): { name: string; country?: string } | null {
  return v as { name: string; country?: string } | null;
}

function castDriver(v: unknown): { id: string; display_name: string; racing_number: number | null } | null {
  return v as { id: string; display_name: string; racing_number: number | null } | null;
}

function castTeam(v: unknown): { id: string; name: string; color_hex: string } | null {
  return v as { id: string; name: string; color_hex: string } | null;
}

function castPenaltyDriver(v: unknown): { display_name: string } | null {
  return v as { display_name: string } | null;
}

function getStoragePublicUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//u.test(path)) return path;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const baseUrl = supabaseUrl.replace(/\/$/u, "");
  const normalizedPath = path.replace(/^\/+/u, "");
  return `${baseUrl}/storage/v1/object/public/${bucket}/${normalizedPath}`;
}

export function LeagueHub({
  league,
  nextRace,
  latestSession,
  topDrivers,
  topConstructors,
  penaltyAlerts,
}: LeagueHubProps) {
  const heroImage =
    getStoragePublicUrl(LEAGUE_ASSETS_BUCKET, league.hero_image_path) ??
    "/images/leagues/race-control-hero.png";

  const nextRaceCircuit = castCircuit(nextRace?.circuits);
  const latestCircuit = castCircuit(latestSession?.circuits);

  const leaderPoints = topDrivers[0]?.total_points ?? 0;
  const constructorLeaderPoints = topConstructors[0]?.total_points ?? 0;

  return (
    <section>
      <div className="hero-band">
        <Image
          alt={`${league.name} hero`}
          className="hero-band__media object-cover"
          fill
          priority
          sizes="100vw"
          src={heroImage}
        />
        <div className="hero-band__content">
          <StatusPill tone={league.status === "active" ? "green" : "red"}>
            {league.status}
          </StatusPill>
          <h1>{league.name}</h1>
          <p className="text-sm text-f1-muted">{league.season.name}</p>
          <RaceCountdown targetIso={nextRace?.scheduled_at ?? null} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-4 border-b border-f1-border pb-4 text-xs text-f1-muted">
          <span className="font-bold uppercase text-f1-white">{league.name}</span>
          <span>{league.season.name}</span>
          {latestSession && (
            <span>Last result: {latestCircuit?.name ?? latestSession.name}</span>
          )}
          <span className="uppercase">{league.format} format</span>
        </div>

        {nextRace && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase text-f1-muted">Next Race</h2>
            <div className="border border-f1-border bg-f1-dark p-4">
              <p className="font-bold text-f1-white">
                {nextRaceCircuit?.name ?? nextRace.name}
              </p>
              {nextRaceCircuit?.country && (
                <p className="text-xs text-f1-muted">{nextRaceCircuit.country}</p>
              )}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase text-f1-muted">Drivers</h2>
            <Link
              className="text-xs text-f1-muted underline-offset-2 hover:text-f1-white hover:underline"
              href={`/leagues/${league.slug}/standings/drivers`}
            >
              Full standings -&gt;
            </Link>
          </div>
          {topDrivers.length === 0 ? (
            <EmptyState message="Standings will appear once results are published." title="No standings yet" />
          ) : (
            <ul className="space-y-1">
              {topDrivers.map((row) => {
                const driver = castDriver(row.drivers);
                const team = castTeam(row.teams);
                const gap = row.position === 1 ? "Leader" : `-${leaderPoints - row.total_points}`;
                return (
                  <li key={row.position} className="flex items-center gap-3 border border-f1-border bg-f1-dark px-4 py-2">
                    <span className="w-6 font-mono text-sm font-bold text-f1-white">{row.position}</span>
                    <PositionDelta current={row.position} previous={row.previous_position} />
                    <span
                      aria-hidden="true"
                      className="h-4 w-1 shrink-0"
                      style={{ backgroundColor: team?.color_hex ?? "#444" }}
                    />
                    {driver ? (
                      <Link
                        className="flex-1 text-sm text-f1-white hover:text-f1-red"
                        href={`/leagues/${league.slug}/drivers/${driver.id}`}
                      >
                        {driver.display_name}
                        {driver.racing_number ? (
                          <span className="ml-2 font-mono text-xs text-f1-muted">#{driver.racing_number}</span>
                        ) : null}
                      </Link>
                    ) : (
                      <span className="flex-1 text-sm text-f1-white">TBD</span>
                    )}
                    <span className="font-mono text-sm text-f1-white">{row.total_points} pts</span>
                    <span className="w-16 text-right font-mono text-xs text-f1-muted">{gap}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {league.constructor_championship_enabled && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase text-f1-muted">Constructors</h2>
              <Link
                className="text-xs text-f1-muted underline-offset-2 hover:text-f1-white hover:underline"
                href={`/leagues/${league.slug}/standings/constructors`}
              >
                Full standings -&gt;
              </Link>
            </div>
            {topConstructors.length === 0 ? (
              <EmptyState message="Constructor standings will appear once results are published." title="No standings yet" />
            ) : (
              <ul className="space-y-1">
                {topConstructors.map((row) => {
                  const team = castTeam(row.teams);
                  const gap = row.position === 1 ? "Leader" : `-${constructorLeaderPoints - row.total_points}`;
                  return (
                    <li key={row.position} className="flex items-center gap-3 border border-f1-border bg-f1-dark px-4 py-2">
                      <span className="w-6 font-mono text-sm font-bold text-f1-white">{row.position}</span>
                      <PositionDelta current={row.position} previous={row.previous_position} />
                      <span
                        aria-hidden="true"
                        className="h-4 w-1 shrink-0"
                        style={{ backgroundColor: team?.color_hex ?? "#444" }}
                      />
                      {team ? (
                        <Link
                          className="flex-1 text-sm text-f1-white hover:text-f1-red"
                          href={`/leagues/${league.slug}/teams/${team.id}`}
                        >
                          {team.name}
                        </Link>
                      ) : (
                        <span className="flex-1 text-sm text-f1-white">TBD</span>
                      )}
                      <span className="font-mono text-sm text-f1-white">{row.total_points} pts</span>
                      <span className="w-16 text-right font-mono text-xs text-f1-muted">{gap}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {penaltyAlerts.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase text-f1-muted">Penalty Watch</h2>
              <Link
                className="text-xs text-f1-muted underline-offset-2 hover:text-f1-white hover:underline"
                href={`/leagues/${league.slug}/penalties`}
              >
                View all -&gt;
              </Link>
            </div>
            <ul className="space-y-1">
              {penaltyAlerts.map((alert) => {
                const driver = castPenaltyDriver(alert.drivers);
                return (
                  <li key={alert.driver_id} className="flex items-center justify-between border border-f1-red/30 bg-f1-dark px-4 py-2">
                    <span className="text-sm text-f1-white">{driver?.display_name ?? "TBD"}</span>
                    <span className="font-mono text-xs text-f1-red">{alert.penalty_points} penalty pts - threshold reached</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {topDrivers.length === 0 && topConstructors.length === 0 && !nextRace && (
          <EmptyState
            message="Race data will appear once sessions, results, and penalties are published."
            title="No published race data yet"
          />
        )}
      </div>
    </section>
  );
}
