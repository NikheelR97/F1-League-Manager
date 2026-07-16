const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  status: "missing" | "ready" | "upcoming";
}

export function getCountdownParts(
  now: Date,
  targetIso: string | null,
): CountdownParts {
  if (!targetIso) {
    return { days: 0, hours: 0, minutes: 0, status: "missing" };
  }

  const targetTime = new Date(targetIso).getTime();
  const diffMs = targetTime - now.getTime();
  if (!Number.isFinite(targetTime) || diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, status: "ready" };
  }

  const totalMinutes = Math.floor(diffMs / MS_PER_SECOND / SECONDS_PER_MINUTE);
  const minutesPerDay = HOURS_PER_DAY * MINUTES_PER_HOUR;
  const days = Math.floor(totalMinutes / minutesPerDay);
  const hours = Math.floor((totalMinutes % minutesPerDay) / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  return { days, hours, minutes, status: "upcoming" };
}
