import { RaceCountdownClient } from "@/components/league/RaceCountdownClient";

interface RaceCountdownProps {
  now?: Date;
  targetIso: string | null;
}

// Resolves "now" once on the server and hands it to the client component as
// the initial state, so the first client render matches SSR output exactly.
// The client component owns re-rendering every 60s from then on (see
// RaceCountdownClient) — this file stays a plain (server-renderable) function
// so callers keep using <RaceCountdown /> unchanged.
export function RaceCountdown({ now = new Date(), targetIso }: RaceCountdownProps) {
  return (
    <RaceCountdownClient initialNowIso={now.toISOString()} targetIso={targetIso} />
  );
}
