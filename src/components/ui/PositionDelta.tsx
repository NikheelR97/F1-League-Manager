import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

interface PositionDeltaProps {
  current: number;
  previous: number | null;
}

export function PositionDelta({ current, previous }: PositionDeltaProps) {
  const delta = previous === null ? 0 : previous - current;

  if (delta > 0) {
    return <ArrowUp aria-label="Position gained" className="text-team-sauber" />;
  }

  if (delta < 0) {
    return <ArrowDown aria-label="Position lost" className="text-f1-red" />;
  }

  return <ArrowRight aria-label="Position unchanged" className="text-f1-muted" />;
}
