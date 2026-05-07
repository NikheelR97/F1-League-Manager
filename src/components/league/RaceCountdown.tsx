import { getCountdownParts } from "@/lib/ui/countdown";

interface RaceCountdownProps {
  now?: Date;
  targetIso: string | null;
}

export function RaceCountdown({
  now = new Date(),
  targetIso,
}: RaceCountdownProps) {
  const parts = getCountdownParts(now, targetIso);

  if (parts.status === "missing") {
    return <p className="font-mono text-sm text-f1-muted">Awaiting schedule</p>;
  }

  if (parts.status === "ready") {
    return <p className="font-mono text-sm text-team-sauber">Race ready</p>;
  }

  return (
    <p className="font-mono text-sm text-f1-silver">
      {parts.days}d {parts.hours}h {parts.minutes}m
    </p>
  );
}
