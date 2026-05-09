"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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

export function WheelManager({ allCircuits, initialPoolIds, leagueId, pendingSpin }: WheelManagerProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [poolIds, setPoolIds] = useState<Set<string>>(new Set(initialPoolIds));
  const [isSavingPool, setIsSavingPool] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localPendingSpin, setLocalPendingSpin] = useState<WheelSpin | null>(pendingSpin ?? null);
  const [showAnimation, setShowAnimation] = useState(false);

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
    setIsSpinning(true);
    setError(null);
    setShowAnimation(true);
    
    // Fake wheel spin animation wait
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/wheel/spin`, {
        method: "POST",
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to spin wheel");
        setShowAnimation(false);
        return;
      }

      setLocalPendingSpin(data.spin);
      router.refresh();
    } finally {
      setIsSpinning(false);
      setShowAnimation(false);
    }
  }

  async function handleVoid() {
    if (!localPendingSpin) return;
    try {
      const res = await fetch(`/api/admin/wheel-spins/${localPendingSpin.id}/void`, {
        method: "POST",
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to void spin");
        return;
      }

      setLocalPendingSpin(null);
      router.refresh();
    } catch {
      setError("Failed to void spin");
    }
  }

  function handleConfirm() {
    if (!localPendingSpin) return;
    router.push(`/admin/leagues/${leagueId}/sessions/new?spin_id=${localPendingSpin.id}&circuit_id=${localPendingSpin.circuit_id}`);
  }

  return (
    <div className="space-y-8">
      {/* Active Spin Area */}
      <section className="rounded-lg border border-f1-border bg-f1-dark p-6">
        <h2 className="mb-4 text-xl font-bold uppercase text-f1-white">Digital Wheel</h2>
        
        {error && <p className="mb-4 text-sm font-bold text-destructive">{error}</p>}

        {showAnimation ? (
          <div className="flex flex-col items-center justify-center py-12 text-f1-white">
            <Loader2 className="animate-spin text-f1-red mb-4" size={48} />
            <p className="text-xl font-bold uppercase tracking-widest animate-pulse">Spinning...</p>
          </div>
        ) : localPendingSpin ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm uppercase text-f1-muted font-bold mb-2">The wheel landed on</p>
            <h3 className="text-3xl font-bold text-f1-white mb-6">
              {localPendingSpin.circuit?.name ?? "Unknown Circuit"}
              <span className="block text-lg text-f1-muted mt-1">{localPendingSpin.circuit?.country}</span>
            </h3>
            
            <div className="flex gap-4">
              <button
                className="border border-f1-muted px-6 py-2 text-sm font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white"
                onClick={handleVoid}
              >
                Void Spin
              </button>
              <button
                className="border border-f1-red bg-f1-red px-6 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
                onClick={handleConfirm}
              >
                Confirm & Create Session
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-f1-muted mb-6 text-center max-w-md">
              Spin the digital wheel to randomly select a circuit from the eligible pool below. This will create a pending spin that you must confirm to schedule the race.
            </p>
            <button
              className="border border-f1-red bg-f1-red px-8 py-3 text-lg font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
              disabled={isSpinning || poolIds.size === 0}
              onClick={handleSpin}
            >
              {isSpinning ? "Spinning..." : "Spin The Wheel"}
            </button>
          </div>
        )}
      </section>

      {/* Pool Setup Area */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase text-f1-white">Circuit Pool Setup</h2>
          <button
            className="border border-f1-border bg-f1-dark px-4 py-2 text-xs font-bold uppercase text-f1-white hover:border-f1-white disabled:opacity-50 transition-colors"
            disabled={isSavingPool}
            onClick={handleSavePool}
          >
            {isSavingPool ? "Saving..." : "Save Pool"}
          </button>
        </div>
        
        <p className="text-sm text-f1-muted">
          Select which circuits are eligible to be chosen by the wheel. Circuits already used in this league cannot be re-added here unless manually reset in the database.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                  type="checkbox"
                  className="h-4 w-4 accent-f1-red"
                  checked={isSelected}
                  onChange={() => toggleCircuit(circuit.id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-f1-white">{circuit.name}</p>
                  <p className="text-xs text-f1-muted">{circuit.country}</p>
                </div>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
