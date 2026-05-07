import { CircleUserRound } from "lucide-react";

interface DriverChipProps {
  name: string;
  team: string;
}

export function DriverChip({ name, team }: DriverChipProps) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 border border-f1-border bg-f1-panel px-3 text-sm text-f1-white">
      <CircleUserRound aria-hidden="true" size={18} />
      <span>
        <strong>{name}</strong>
        <span className="ml-2 text-f1-muted">{team}</span>
      </span>
    </span>
  );
}
