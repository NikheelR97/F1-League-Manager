import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

interface PositionDeltaProps {
  current: number;
  previous: number | null;
  /**
   * Standings tables: smaller glyphs, and no marker at all when the position is
   * unchanged. A neutral arrow on every static row is noise, not signal — most
   * rows don't move between rounds, so the movers should be what catches the eye.
   */
  compact?: boolean;
}

export function PositionDelta({ current, previous, compact = false }: PositionDeltaProps) {
  const delta = previous === null ? 0 : previous - current;
  const size = compact ? 12 : undefined;

  if (delta > 0) {
    return <ArrowUp aria-label="Position gained" className="text-team-sauber" size={size} />;
  }

  if (delta < 0) {
    return <ArrowDown aria-label="Position lost" className="text-f1-red" size={size} />;
  }

  if (compact) return null;

  return <ArrowRight aria-label="Position unchanged" className="text-f1-muted" />;
}
