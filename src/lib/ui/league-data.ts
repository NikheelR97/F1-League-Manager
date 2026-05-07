import {
  F1_INFORMAL_RACE_PCT,
  F1_STANDARD_RACE_PCT,
  MAX_HUB_STAT_ITEMS,
  MAX_PUBLIC_LEAGUE_CARDS,
} from "@/lib/constants";

export type LeagueTheme = "race-control" | "race-weekend";

export interface LeagueSummary {
  constructorLeader: string;
  formatLabel: string;
  heroAlt: string;
  heroImage: string;
  href: string;
  leader: string;
  name: string;
  nextRace: string;
  nextRaceAt: string;
  penaltyWatch: string;
  slug: "informal" | "standard";
  status: string;
  theme: LeagueTheme;
  wheelStatus: string;
}

export interface HubStat {
  label: string;
  value: string;
}

export const leagueSummaries: readonly LeagueSummary[] = [
  {
    constructorLeader: "Standings pending",
    formatLabel: `2 x ${F1_INFORMAL_RACE_PCT}% races`,
    heroAlt: "Dusk race circuit pit straight with red timing lights",
    heroImage: "/images/leagues/race-weekend-hero.png",
    href: "/leagues/informal",
    leader: "Season setup",
    name: "Informal League",
    nextRace: "Calendar population",
    nextRaceAt: "Admin scheduled",
    penaltyWatch: "Manual review",
    slug: "informal",
    status: "Setup",
    theme: "race-weekend",
    wheelStatus: "Manual calendar",
  },
  {
    constructorLeader: "Standings pending",
    formatLabel: `${F1_STANDARD_RACE_PCT}% feature race`,
    heroAlt: "Race control garage with timing monitors beside a pit lane",
    heroImage: "/images/leagues/race-control-hero.png",
    href: "/leagues/standard",
    leader: "Season setup",
    name: "Standard League",
    nextRace: "Wheel pool setup",
    nextRaceAt: "Admin scheduled",
    penaltyWatch: "Manual review",
    slug: "standard",
    status: "Setup",
    theme: "race-control",
    wheelStatus: "Wheel pending",
  },
] as const;

export function getLeagueSummaries(): readonly LeagueSummary[] {
  return leagueSummaries.slice(0, MAX_PUBLIC_LEAGUE_CARDS);
}

export function getLeagueBySlug(slug: string): LeagueSummary | null {
  const summaries = getLeagueSummaries();
  const league = summaries.find((summary) => summary.slug === slug);

  return league ?? null;
}

export function getHubStats(league: LeagueSummary): readonly HubStat[] {
  const stats: readonly HubStat[] = [
    { label: "Format", value: league.formatLabel },
    { label: "Next race", value: league.nextRace },
    { label: "Driver leader", value: league.leader },
    { label: "Constructors", value: league.constructorLeader },
    { label: "Penalties", value: league.penaltyWatch },
    { label: "Wheel", value: league.wheelStatus },
  ];

  return stats.slice(0, MAX_HUB_STAT_ITEMS);
}
