// Pure diff between workbook-stated standings and app-calculated standings.
// No DB access — receives pre-fetched data from import-service.ts.

import type { ParsedWorkbook } from "./types";
import type { ComputedStandings } from "./import-service";

export interface DiffItem {
  name: string;
  workbookPoints: number;
  appPoints: number;
  match: boolean;
}

export interface ImportDiff {
  drivers: DiffItem[];
  constructors: DiffItem[];
  clean: boolean;
}

// Normalise team names for comparison (workbook uses short names, DB has full names)
const TEAM_DISPLAY_ALIASES: Record<string, string> = {
  "Red Bull Racing": "Red Bull",
  "Racing Bulls": "RB",
  "Kick Sauber": "KICK Sauber",
};

function normTeam(name: string): string {
  return TEAM_DISPLAY_ALIASES[name] ?? name;
}

export function buildDiff(
  workbook: ParsedWorkbook,
  computed: ComputedStandings,
): ImportDiff {
  // Driver diff — compare workbook standings to app standings
  const appDriverMap = new Map(
    computed.drivers.map((d) => [d.name.trim(), d.total_points]),
  );

  // Exclude placeholder/dash rows from workbook
  const wbDrivers = workbook.workbookDriverStandings.filter(
    (d) => d.name && d.name !== "-",
  );

  const driverItems: DiffItem[] = wbDrivers.map((wd) => {
    const appPts = appDriverMap.get(wd.name) ?? null;
    return {
      name: wd.name,
      workbookPoints: wd.points,
      appPoints: appPts ?? -1,
      match: appPts !== null && appPts === wd.points,
    };
  });

  // Also surface drivers that appear in app standings but not in workbook
  const wbDriverNames = new Set(wbDrivers.map((d) => d.name));
  for (const ad of computed.drivers) {
    if (!wbDriverNames.has(ad.name) && ad.total_points > 0) {
      driverItems.push({
        name: ad.name,
        workbookPoints: -1,
        appPoints: ad.total_points,
        match: false,
      });
    }
  }

  // Constructor diff
  const appTeamMap = new Map(
    computed.constructors.map((t) => [normTeam(t.name), t.total_points]),
  );

  const wbConstructors = workbook.workbookConstructorStandings.filter(
    (c) => c.team && c.team !== "---",
  );

  const constructorItems: DiffItem[] = wbConstructors.map((wc) => {
    const appPts = appTeamMap.get(wc.team) ?? null;
    return {
      name: wc.team,
      workbookPoints: wc.points,
      appPoints: appPts ?? -1,
      match: appPts !== null && appPts === wc.points,
    };
  });

  const clean =
    driverItems.every((d) => d.match) && constructorItems.every((c) => c.match);

  return { drivers: driverItems, constructors: constructorItems, clean };
}
