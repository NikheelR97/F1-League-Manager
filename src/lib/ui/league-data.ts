import {
  F1_INFORMAL_RACE_PCT,
  F1_STANDARD_RACE_PCT,
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
  penaltyWatch: string;
  slug: "informal" | "standard";
  status: string;
  theme: LeagueTheme;
  wheelStatus: string;
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
