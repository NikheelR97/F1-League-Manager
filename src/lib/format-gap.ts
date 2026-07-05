export function formatGap(leaderPoints: number, points: number, position: number): string {
  if (position === 1) return "Leader";
  return `-${leaderPoints - points} pts`;
}
