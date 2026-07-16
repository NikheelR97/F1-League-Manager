export function formatGap(leaderPoints: number, points: number, position: number): string {
  if (position === 1) return "Leader";
  const gap = leaderPoints - points;
  if (gap === 0) return "TIED";
  return `-${gap} pts`;
}
