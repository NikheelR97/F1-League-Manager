interface WheelSpinRecord {
  circuit_id: string;
  status: string;
}

export function selectWheelCircuit<T>(availableCircuits: T[]): T {
  if (!availableCircuits || availableCircuits.length === 0) {
    throw new Error("No circuits available in the pool.");
  }
  
  const randomIndex = Math.floor(Math.random() * availableCircuits.length);
  const chosen = availableCircuits[randomIndex];
  
  if (!chosen) {
    throw new Error("Wheel selected a null circuit.");
  }
  
  return chosen;
}

export function validateWheelConfirmation(
  spin: WheelSpinRecord | null,
  submittedCircuitId: string,
): { ok: false; status: number; error: string } | null {
  if (!spin) {
    return { ok: false, status: 404, error: "Wheel spin not found" };
  }
  
  if (spin.status !== "pending") {
    // Satisfies: 8. Double confirmation is rejected.
    return { ok: false, status: 400, error: "Wheel spin is not pending" };
  }
  
  if (spin.circuit_id !== submittedCircuitId) {
    // Satisfies: 7. Client cannot forge wheel result.
    return { ok: false, status: 400, error: "Circuit mismatch with wheel spin" };
  }
  
  return null;
}
