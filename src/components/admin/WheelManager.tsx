"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

interface Circuit {
  country: string;
  id: string;
  name: string;
}

interface WheelSpin {
  circuit_id: string;
  id: string;
  status: string;
  circuit?: { country: string; name: string };
}

interface WheelManagerProps {
  allCircuits: Circuit[];
  initialPoolIds: string[];
  leagueId: string;
  pendingSpin?: WheelSpin | null;
}

type SpinState = "idle" | "spinning" | "revealing" | "pending";

export function WheelManager({ allCircuits, initialPoolIds, leagueId, pendingSpin }: WheelManagerProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [poolIds, setPoolIds] = useState<Set<string>>(new Set(initialPoolIds));
  const [isSavingPool, setIsSavingPool] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spinState, setSpinState] = useState<SpinState>(pendingSpin ? "pending" : "idle");
  const [localPendingSpin, setLocalPendingSpin] = useState<WheelSpin | null>(pendingSpin ?? null);

  // Slot-machine cycling display during spin
  const [cyclingName, setCyclingName] = useState<string>("");
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleIndexRef = useRef(0);

  const poolCircuits = allCircuits.filter((c) => poolIds.has(c.id));

  // Run the slot-machine animation — speeds up at start, slows to reveal
  function runSlotAnimation(onDone: () => void) {
    if (poolCircuits.length === 0) {
      onDone();
      return;
    }

    // Total duration ≈ 2 400ms. Intervals: 6×80ms → 6×120ms → 6×200ms → 3×350ms → 1×500ms
    const schedule: number[] = [
      ...Array(8).fill(70),
      ...Array(8).fill(110),
      ...Array(6).fill(180),
      ...Array(4).fill(300),
      ...Array(2).fill(450),
    ];

    let i = 0;
    function tick() {
      cycleIndexRef.current = (cycleIndexRef.current + 1) % poolCircuits.length;
      setCyclingName(poolCircuits[cycleIndexRef.current]?.name ?? "");

      if (i < schedule.length - 1) {
        cycleTimerRef.current = setTimeout(tick, schedule[i++]);
      } else {
        // Done cycling — wait briefly then trigger resolve
        cycleTimerRef.current = setTimeout(onDone, 300);
      }
    }

    tick();
  }

  function stopSlotAnimation() {
    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopSlotAnimation();
  }, []);

  function toggleCircuit(id: string) {
    setPoolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSavePool() {
    setIsSavingPool(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/circuit-pool`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ circuit_ids: Array.from(poolIds) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save pool");
        return;
      }

      router.refresh();
      alert("Pool saved successfully.");
    } finally {
      setIsSavingPool(false);
    }
  }

  async function handleSpin() {
    setError(null);
    setSpinState("spinning");
    setCyclingName(poolCircuits[0]?.name ?? "");

    let apiResult: WheelSpin | null = null;

    // Fire API and animation in parallel
    const [, spinResult] = await Promise.allSettled([
      new Promise<void>((resolve) => runSlotAnimation(resolve)),
      fetch(`/api/admin/leagues/${leagueId}/wheel/spin`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Failed to spin wheel");
          apiResult = data.spin as WheelSpin;
        }),
    ]);

    stopSlotAnimation();

    if (spinResult.status === "rejected") {
      setError(spinResult.reason instanceof Error ? spinResult.reason.message : "Failed to spin");
      setSpinState("idle");
      return;
    }

    if (!apiResult) {
      setError("No result returned from server");
      setSpinState("idle");
      return;
    }

    setLocalPendingSpin(apiResult);
    setSpinState("revealing");
    router.refresh();
  }

  async function handleVoid() {
    if (!localPendingSpin) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/wheel-spins/${localPendingSpin.id}/void`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to void spin");
        return;
      }

      setLocalPendingSpin(null);
      setSpinState("idle");
      router.refresh();
    } catch {
      setError("Failed to void spin");
    }
  }

  function handleConfirm() {
    if (!localPendingSpin) return;
    router.push(
      `/admin/leagues/${leagueId}/sessions/new?spin_id=${localPendingSpin.id}&circuit_id=${localPendingSpin.circuit_id}`,
    );
  }

  // After reveal, transition to pending state
  function handleRevealDone() {
    setSpinState("pending");
  }

  return (
    <div className="space-y-8">
      {/* Active Spin Area */}
      <section className="border border-f1-border bg-f1-dark p-6">
        <h2 className="mb-6 text-xl font-bold uppercase text-f1-white">Digital Wheel</h2>

        {error && (
          <p className="mb-4 text-sm font-bold text-f1-red" role="alert">
            {error}
          </p>
        )}

        {spinState === "spinning" && (
          <div
            aria-label="Spinning the wheel"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-12"
          >
            {/* Slot machine frame */}
            <div className="relative mb-6 w-72 overflow-hidden border-2 border-f1-red bg-black px-6 py-4 text-center">
              {/* Racing stripes */}
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-f1-red" />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-f1-red" />
              <p
                className="font-mono text-2xl font-bold uppercase tracking-widest text-f1-white"
                style={{ minHeight: "2rem" }}
              >
                {cyclingName}
              </p>
            </div>
            <p className="animate-pulse text-xs font-bold uppercase tracking-widest text-f1-muted">
              Selecting circuit…
            </p>
          </div>
        )}

        {spinState === "revealing" && localPendingSpin && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            onAnimationEnd={handleRevealDone}
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-f1-muted">
              The wheel landed on
            </p>
            <div
              className="animate-[reveal_0.5s_ease-out_forwards] mb-6 border-2 border-f1-red px-8 py-4 opacity-0"
              style={{ animationFillMode: "forwards" }}
            >
              <p className="text-4xl font-bold uppercase tracking-wide text-f1-white">
                {localPendingSpin.circuit?.name ?? "Unknown Circuit"}
              </p>
              <p className="mt-1 text-base uppercase text-f1-muted">
                {localPendingSpin.circuit?.country}
              </p>
            </div>
            <p className="text-xs text-f1-muted">Loading…</p>
          </div>
        )}

        {(spinState === "pending") && localPendingSpin && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-f1-muted">
              The wheel landed on
            </p>
            <div className="mb-6 border-2 border-f1-red px-8 py-4">
              <p className="text-4xl font-bold uppercase tracking-wide text-f1-white">
                {localPendingSpin.circuit?.name ?? "Unknown Circuit"}
              </p>
              <p className="mt-1 text-base uppercase text-f1-muted">
                {localPendingSpin.circuit?.country}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                className="border border-f1-muted px-6 py-2 text-sm font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white focus:outline-none focus:ring-2 focus:ring-f1-white focus:ring-offset-2 focus:ring-offset-black"
                onClick={handleVoid}
                type="button"
              >
                Void Spin
              </button>
              <button
                className="border border-f1-red bg-f1-red px-6 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-black"
                onClick={handleConfirm}
                type="button"
              >
                Confirm & Create Session
              </button>
            </div>
          </div>
        )}

        {spinState === "idle" && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="mb-6 max-w-md text-center text-sm text-f1-muted">
              Spin the digital wheel to randomly select a circuit from the eligible pool below. This will create a pending spin that you must confirm to schedule the race.
            </p>
            <button
              className="border border-f1-red bg-f1-red px-8 py-3 text-lg font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-black"
              disabled={poolIds.size === 0}
              onClick={handleSpin}
              type="button"
            >
              Spin The Wheel
            </button>
            {poolIds.size === 0 && (
              <p className="mt-3 text-xs text-f1-muted" role="status">
                Add circuits to the pool below before spinning.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Pool Setup Area */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase text-f1-white">
            Circuit Pool Setup
            <span className="ml-2 text-sm font-normal text-f1-muted">
              ({poolIds.size} selected)
            </span>
          </h2>
          <button
            className="border border-f1-border bg-f1-dark px-4 py-2 text-xs font-bold uppercase text-f1-white transition-colors hover:border-f1-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-f1-white focus:ring-offset-2 focus:ring-offset-black"
            disabled={isSavingPool}
            onClick={handleSavePool}
            type="button"
          >
            {isSavingPool ? "Saving…" : "Save Pool"}
          </button>
        </div>

        <p className="text-sm text-f1-muted">
          Select which circuits are eligible to be chosen by the wheel. Circuits already used in this league will be excluded automatically.
        </p>

        <fieldset>
          <legend className="sr-only">Eligible circuits</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {allCircuits.map((circuit) => {
              const isSelected = poolIds.has(circuit.id);
              return (
                <label
                  key={circuit.id}
                  className={`flex cursor-pointer items-center gap-3 border p-3 transition-colors ${
                    isSelected
                      ? "border-f1-red bg-f1-red/10"
                      : "border-f1-border bg-f1-dark hover:border-f1-white"
                  }`}
                >
                  <input
                    checked={isSelected}
                    className="h-4 w-4 accent-f1-red"
                    onChange={() => toggleCircuit(circuit.id)}
                    type="checkbox"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-f1-white">{circuit.name}</p>
                    <p className="text-xs text-f1-muted">{circuit.country}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>
    </div>
  );
}
