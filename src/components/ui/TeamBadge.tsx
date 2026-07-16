import { MAX_TEAM_BADGE_LABEL_LENGTH } from "@/lib/constants";

interface TeamBadgeProps {
  color: string;
  label: string;
}

export function TeamBadge({ color, label }: TeamBadgeProps) {
  const safeLabel = label.slice(0, MAX_TEAM_BADGE_LABEL_LENGTH);

  return (
    <span className="inline-flex min-h-8 items-center gap-2 border border-f1-border px-3 text-xs font-bold uppercase text-f1-white">
      <span
        aria-hidden="true"
        className="h-3 w-3"
        style={{ backgroundColor: color }}
      />
      {safeLabel}
    </span>
  );
}
