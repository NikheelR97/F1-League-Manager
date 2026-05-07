import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

interface PositionDeltaProps {
  value: -1 | 0 | 1;
}

export function PositionDelta({ value }: PositionDeltaProps) {
  if (value > 0) {
    return <ArrowUp aria-label="Position gained" className="text-team-sauber" />;
  }

  if (value < 0) {
    return <ArrowDown aria-label="Position lost" className="text-f1-red" />;
  }

  return <ArrowRight aria-label="Position unchanged" className="text-f1-muted" />;
}
