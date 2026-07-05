"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const KIND_OPTIONS = ["bonus", "penalty", "correction"] as const;

// ponytail: one select with "driver:<id>" / "team:<id>" values instead of two
// mutually-exclusive fields — enforces the DB's one-target check for free,
// no extra state to keep in sync.
const adjustmentSchema = z.object({
  adjustment_kind: z.enum(KIND_OPTIONS),
  points_delta: z
    .number()
    .int("Whole numbers only")
    .min(-200, "Minimum is -200")
    .max(200, "Maximum is 200"),
  reason: z.string().trim().min(1, "Reason is required").max(240),
  target: z.string().min(1, "Select a target"),
});

type AdjustmentFields = z.infer<typeof adjustmentSchema>;

interface Target {
  label: string;
  value: string;
}

interface AdjustmentFormProps {
  leagueId: string;
  seasonId: string;
  targets: Target[];
}

export function AdjustmentForm({ leagueId, seasonId, targets }: AdjustmentFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [success, setSuccess] = useState(false);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<AdjustmentFields>({
    defaultValues: {
      adjustment_kind: "bonus",
      reason: "",
      target: "",
    },
    resolver: zodResolver(adjustmentSchema),
  });

  async function onValid(values: AdjustmentFields) {
    setSuccess(false);
    const [kind, targetId] = values.target.split(":");

    const res = await fetch(`/api/admin/leagues/${leagueId}/adjustments`, {
      body: JSON.stringify({
        adjustment_kind: values.adjustment_kind,
        driver_id: kind === "driver" ? targetId : null,
        points_delta: values.points_delta,
        reason: values.reason,
        season_id: seasonId,
        team_id: kind === "team" ? targetId : null,
      }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "POST",
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError("root", { message: data.error ?? "Failed to create adjustment." });
      return;
    }

    reset({ adjustment_kind: "bonus", points_delta: undefined, reason: "", target: "" });
    setSuccess(true);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onValid)}>
      <div className="space-y-1">
        <Label htmlFor="adj-target">Target</Label>
        <select
          aria-describedby={errors.target ? "adj-target-error" : undefined}
          aria-invalid={!!errors.target}
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="adj-target"
          {...register("target")}
        >
          <option value="">Select driver or team…</option>
          {targets.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {errors.target && (
          <p className="text-xs text-f1-red-text" id="adj-target-error">{errors.target.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="adj-kind">Kind</Label>
        <select
          aria-describedby={errors.adjustment_kind ? "adj-kind-error" : undefined}
          aria-invalid={!!errors.adjustment_kind}
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="adj-kind"
          {...register("adjustment_kind")}
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {errors.adjustment_kind && (
          <p className="text-xs text-f1-red-text" id="adj-kind-error">{errors.adjustment_kind.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="adj-points">Points</Label>
        <Input
          aria-describedby="adj-points-help adj-points-error"
          aria-invalid={!!errors.points_delta}
          className="bg-f1-dark font-mono text-f1-white"
          id="adj-points"
          max={200}
          min={-200}
          step={1}
          type="number"
          {...register("points_delta", { valueAsNumber: true })}
        />
        <p className="text-xs text-f1-muted" id="adj-points-help">
          Points are added as entered — use a negative value to deduct.
        </p>
        {errors.points_delta && (
          <p className="text-xs text-f1-red-text" id="adj-points-error">{errors.points_delta.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="adj-reason">Reason</Label>
        <Input
          aria-describedby={errors.reason ? "adj-reason-error" : undefined}
          aria-invalid={!!errors.reason}
          id="adj-reason"
          maxLength={240}
          placeholder="e.g. Post-race steward correction — R4 collision"
          {...register("reason")}
          className="bg-f1-dark text-f1-white"
        />
        {errors.reason && (
          <p className="text-xs text-f1-red-text" id="adj-reason-error">{errors.reason.message}</p>
        )}
      </div>

      <FormError message={errors.root?.message} />

      {success && (
        <p className="text-xs font-bold text-green-400" role="status">
          Adjustment created — standings recalculated.
        </p>
      )}

      <button
        className="w-full border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting || !csrfToken}
        type="submit"
      >
        {isSubmitting ? "Saving…" : "Create Adjustment"}
      </button>
    </form>
  );
}
