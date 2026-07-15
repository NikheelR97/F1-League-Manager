export interface EnrollRow {
  display_name: string;
  racing_number: number | null;
  team_id: string | null; // null = free agent (no team)
  is_reserve: boolean;
}

export interface PlanInput {
  rows: EnrollRow[];
  enrolledNamesLower: Set<string>; // display_names (lowercased) already actively enrolled in the league
  existingPrimaryCountByTeam: Map<string, number>; // team_id -> current active NON-reserve driver count
  teamNameById: Map<string, string>; // team_id -> team name (for overflow messages)
  maxPrimaryPerTeam: number; // MAX_PRIMARY_DRIVERS_PER_TEAM = 2
}

export interface TeamOverflow {
  team_id: string;
  team_name: string;
  attempted: number;
  cap: number;
}

export interface PlanResult {
  toEnroll: EnrollRow[];
  skippedAlreadyEnrolled: string[];
  duplicateInBatch: string[];
  teamOverflows: TeamOverflow[];
}

// Pure planning logic for the "bulk add drivers" route: dedupe within the
// batch, skip already-enrolled names, and validate the per-team primary-driver
// cap before any DB write. Kept server-free so it's unit-tested without
// pulling in the service-role client.
export function planBulkEnroll(input: PlanInput): PlanResult {
  const { rows, enrolledNamesLower, existingPrimaryCountByTeam, teamNameById, maxPrimaryPerTeam } = input;

  const toEnroll: EnrollRow[] = [];
  const skippedAlreadyEnrolled: string[] = [];
  const duplicateInBatch: string[] = [];
  const seenLower = new Set<string>();

  for (const row of rows) {
    const name = row.display_name.trim();
    if (!name) continue;

    const nameLower = name.toLowerCase();
    if (seenLower.has(nameLower)) {
      duplicateInBatch.push(name);
      continue;
    }
    seenLower.add(nameLower);

    if (enrolledNamesLower.has(nameLower)) {
      skippedAlreadyEnrolled.push(name);
      continue;
    }

    toEnroll.push({ ...row, display_name: name });
  }

  const newPrimaryCountByTeam = new Map<string, number>();
  for (const row of toEnroll) {
    if (row.team_id === null || row.is_reserve) continue;
    newPrimaryCountByTeam.set(row.team_id, (newPrimaryCountByTeam.get(row.team_id) ?? 0) + 1);
  }

  const teamOverflows: TeamOverflow[] = [];
  for (const [teamId, added] of newPrimaryCountByTeam) {
    const count = (existingPrimaryCountByTeam.get(teamId) ?? 0) + added;
    if (count > maxPrimaryPerTeam) {
      teamOverflows.push({
        team_id: teamId,
        team_name: teamNameById.get(teamId) ?? teamId,
        attempted: count,
        cap: maxPrimaryPerTeam,
      });
    }
  }

  return { toEnroll, skippedAlreadyEnrolled, duplicateInBatch, teamOverflows };
}
