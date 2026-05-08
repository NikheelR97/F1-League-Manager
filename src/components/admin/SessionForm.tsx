"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const SESSION_CODE_RE = /^[A-Z0-9]{6}$/;

interface Circuit {
  country: string;
  id: string;
  name: string;
}

interface PointsSystem {
  id: string;
  name: string;
}

interface Session {
  circuit_id: string;
  id: string;
  name: string;
  points_system_id: string;
  race_length_percent: 25 | 50 | 100;
  race_number: 1 | 2;
  scheduled_at: string;
  session_code: string;
}

interface SessionFormProps {
  circuits: Circuit[];
  initialCircuitId?: string;
  leagueId: string;
  pointsSystems: PointsSystem[];
  session?: Session;
  wheelSpinId?: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function SessionForm({ circuits, initialCircuitId, leagueId, pointsSystems, session, wheelSpinId }: SessionFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const [name, setName] = useState(session?.name ?? "");
  const [sessionCode, setSessionCode] = useState(session?.session_code ?? generateCode);
  const [circuitId, setCircuitId] = useState(session?.circuit_id ?? initialCircuitId ?? "");
  const [pointsSystemId, setPointsSystemId] = useState(session?.points_system_id ?? pointsSystems[0]?.id ?? "");
  const [raceNumber, setRaceNumber] = useState<1 | 2>(session?.race_number ?? 1);
  const [raceLengthPercent, setRaceLengthPercent] = useState<25 | 50 | 100>(session?.race_length_percent ?? 100);
  
  // Format the existing scheduled_at to YYYY-MM-DDThh:mm so it fits the datetime-local input
  const initialDate = session?.scheduled_at 
    ? new Date(session.scheduled_at).toISOString().slice(0, 16) 
    : "";
  const [scheduledAt, setScheduledAt] = useState(initialDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase();
    setSessionCode(val);
    setCodeError(SESSION_CODE_RE.test(val) ? null : "Must be exactly 6 uppercase letters or digits");
  }

  function handleCircuitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCircuitId(e.target.value);
    if (!name) {
      const circuit = circuits.find((c) => c.id === e.target.value);
      if (circuit) setName(`${circuit.name} Race`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!SESSION_CODE_RE.test(sessionCode)) {
      setCodeError("Must be exactly 6 uppercase letters or digits");
      return;
    }

    // Validate scheduled_at is a valid datetime
    const parsed = z.string().datetime({ offset: true }).safeParse(new Date(scheduledAt).toISOString());
    if (!parsed.success) {
      setError("Invalid scheduled date");
      return;
    }

    setSubmitting(true);
    try {
      const url = session 
        ? `/api/admin/sessions/${session.id}`
        : `/api/admin/leagues/${leagueId}/sessions`;
        
      const res = await fetch(url, {
        body: JSON.stringify({
          circuit_id: circuitId,
          name,
          points_system_id: pointsSystemId,
          race_length_percent: raceLengthPercent,
          race_number: raceNumber,
          scheduled_at: new Date(scheduledAt).toISOString(),
          session_code: sessionCode,
          wheel_spin_id: wheelSpinId,
        }),
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        method: session ? "PATCH" : "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `Failed to ${session ? "update" : "create"} session.`);
        return;
      }

      router.push(`/admin/leagues/${leagueId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {/* Circuit */}
      <div className="space-y-1">
        <Label htmlFor="circuit">Circuit</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none disabled:opacity-50"
          disabled={!!wheelSpinId}
          id="circuit"
          required
          value={circuitId}
          onChange={handleCircuitChange}
        >
          <option value="">Select a circuit…</option>
          {circuits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.country})
            </option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="session-name">Session name</Label>
        <Input
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
          id="session-name"
          placeholder="Bahrain Race"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Session code */}
      <div className="space-y-1">
        <Label htmlFor="session-code">Session code</Label>
        <div className="flex gap-2">
          <Input
            className="font-mono bg-f1-dark text-f1-white placeholder:text-f1-muted uppercase"
            id="session-code"
            maxLength={6}
            placeholder="ABC123"
            value={sessionCode}
            onChange={handleCodeChange}
          />
          <button
            className="border border-f1-border px-3 py-2 text-xs text-f1-muted hover:border-f1-white hover:text-f1-white"
            type="button"
            onClick={() => { setSessionCode(generateCode()); setCodeError(null); }}
          >
            Regenerate
          </button>
        </div>
        {codeError && <p className="text-xs text-destructive">{codeError}</p>}
      </div>

      {/* Points system */}
      <div className="space-y-1">
        <Label htmlFor="points-system">Points system</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="points-system"
          value={pointsSystemId}
          onChange={(e) => setPointsSystemId(e.target.value)}
        >
          {pointsSystems.map((ps) => (
            <option key={ps.id} value={ps.id}>
              {ps.name}
            </option>
          ))}
        </select>
      </div>

      {/* Race number */}
      <div className="space-y-1">
        <Label>Race number</Label>
        <div className="flex gap-4">
          {([1, 2] as const).map((n) => (
            <label className="flex items-center gap-2 text-sm text-f1-white" key={n}>
              <input
                checked={raceNumber === n}
                className="accent-f1-red"
                name="race-number"
                type="radio"
                value={n}
                onChange={() => setRaceNumber(n)}
              />
              Race {n} {n === 2 ? "(Sprint)" : "(Feature)"}
            </label>
          ))}
        </div>
      </div>

      {/* Race length */}
      <div className="space-y-1">
        <Label>Race length</Label>
        <div className="flex gap-4">
          {([25, 50, 100] as const).map((pct) => (
            <label className="flex items-center gap-2 text-sm text-f1-white" key={pct}>
              <input
                checked={raceLengthPercent === pct}
                className="accent-f1-red"
                name="race-length"
                type="radio"
                value={pct}
                onChange={() => setRaceLengthPercent(pct)}
              />
              {pct}%
            </label>
          ))}
        </div>
      </div>

      {/* Scheduled at */}
      <div className="space-y-1">
        <Label htmlFor="scheduled-at">Scheduled date &amp; time</Label>
        <Input
          className="bg-f1-dark text-f1-white"
          id="scheduled-at"
          required
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        className="w-full border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={submitting || !circuitId || !name || !pointsSystemId || !scheduledAt}
        type="submit"
      >
        {submitting ? (session ? "Updating…" : "Creating…") : (session ? "Update Session" : "Create Session")}
      </button>
    </form>
  );
}
