"use client";

import { useEffect, useState } from "react";

import { getCountdownParts } from "@/lib/ui/countdown";

const TICK_INTERVAL_MS = 60_000;

interface RaceCountdownClientProps {
  /** ISO timestamp of the server-rendered "now" — used as the initial state so
   * the client's first render matches SSR output exactly (no hydration mismatch). */
  initialNowIso: string;
  targetIso: string | null;
}

export function RaceCountdownClient({
  initialNowIso,
  targetIso,
}: RaceCountdownClientProps) {
  const [now, setNow] = useState(() => new Date(initialNowIso));

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    function tick() {
      setNow(new Date());
    }

    function startInterval() {
      if (intervalId !== undefined) return;
      intervalId = setInterval(tick, TICK_INTERVAL_MS);
    }

    function stopInterval() {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopInterval();
        return;
      }
      // Refresh immediately on becoming visible again, then resume ticking.
      tick();
      startInterval();
    }

    if (document.visibilityState !== "hidden") {
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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
