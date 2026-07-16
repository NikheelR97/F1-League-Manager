import "server-only";

export interface PointsSystem {
  points_by_position: Record<string, number>;
  fastest_lap_points: number;
  pole_position_points: number;
}

export interface RacePointsInput {
  finishing_position: number | null;
  result_status: string;
  is_fastest_lap: boolean;
  is_pole: boolean;
  league_fastest_lap_enabled: boolean;
  league_pole_enabled: boolean;
  points_system: PointsSystem;
}

// Server-authoritative points calculation. Client-supplied points are never trusted.
// See HANDOVER §7 and §10.
export function calculateRacePoints(input: RacePointsInput): number {
  const {
    finishing_position,
    result_status,
    is_fastest_lap,
    is_pole,
    league_fastest_lap_enabled,
    league_pole_enabled,
    points_system,
  } = input;

  if (result_status !== "classified" || finishing_position === null) {
    return 0;
  }

  const positionPoints =
    points_system.points_by_position[String(finishing_position)] ?? 0;
  const flBonus =
    league_fastest_lap_enabled && is_fastest_lap
      ? points_system.fastest_lap_points
      : 0;
  const poleBonus =
    league_pole_enabled && is_pole ? points_system.pole_position_points : 0;

  return positionPoints + flBonus + poleBonus;
}
