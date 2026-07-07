"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format-date";
import { MAX_PRIMARY_DRIVERS_PER_TEAM } from "@/lib/constants";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";

// Sentinel for "no completed race boundary yet" — B6 fallback option.
const IMMEDIATE_VALUE = "__immediate__";

const transferSchema = z.object({
  driver_entry_id: z.string().uuid("Select a driver"),
  new_team_id: z.string().uuid().nullable(),
  race_session_id: z.string().min(1, "Select an effective date option"),
  remove_from_league: z.boolean(),
  transfer_reason: z.string().trim().max(240).optional(),
});

type TransferFields = z.infer<typeof transferSchema>;

interface Driver {
  entryId: string;
  isReserve: boolean;
  name: string;
  teamName: string;
}

interface Team {
  id: string;
  name: string;
  primaryCount: number;
}

interface Session {
  date: string;
  id: string;
  label: string;
}

interface TransferFormProps {
  drivers: Driver[];
  leagueId: string;
  sessions: Session[];
  teams: Team[];
}

function resolveEffectiveDate(sessionChoice: string, sessions: Session[]): string {
  if (sessionChoice === IMMEDIATE_VALUE) return new Date().toISOString().slice(0, 10);
  return sessions.find((s) => s.id === sessionChoice)?.date ?? new Date().toISOString().slice(0, 10);
}

// B6 — plain conditional rendering for the review step; no wizard framework.
type Stage = "form" | "review" | "success";

export function TransferForm({ drivers, leagueId, sessions, teams }: TransferFormProps) {
  const csrfToken = useCsrfToken();
  const [stage, setStage] = useState<Stage>("form");
  // K1 — each stage swap replaces the visible content; without moving focus
  // along, it's stuck wherever the previous stage's control (e.g. "Back")
  // used to be, or on <body> once that control unmounts.
  // skipInitial on the form stage so the initial page load doesn't steal
  // focus — only a later return to it (via Back) should.
  const formRef = useFocusOnMount<HTMLDivElement>(stage === "form", true);
  const reviewRef = useFocusOnMount<HTMLDivElement>(stage === "review");
  const successRef = useFocusOnMount<HTMLDivElement>(stage === "success");

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<TransferFields>({
    defaultValues: {
      new_team_id: null,
      race_session_id: "",
      remove_from_league: false,
    },
    resolver: zodResolver(transferSchema),
  });

  const driverEntryId = useWatch({ control, name: "driver_entry_id" });
  const newTeamId = useWatch({ control, name: "new_team_id" });
  const raceSessionId = useWatch({ control, name: "race_session_id" });
  const removeFromLeague = useWatch({ control, name: "remove_from_league" });

  const selectedDriver = drivers.find((d) => d.entryId === driverEntryId);
  const selectedTeam = teams.find((t) => t.id === newTeamId);

  const effectiveDate = raceSessionId ? resolveEffectiveDate(raceSessionId, sessions) : "";
  const summary = `${selectedDriver?.name ?? "Driver"}: ${selectedDriver?.teamName ?? "—"} (until ${
    effectiveDate ? formatDate(effectiveDate) : "—"
  }) → ${newTeamId ? selectedTeam?.name ?? "Unknown team" : "Free Agent"}${
    !newTeamId && removeFromLeague ? ", leaving league" : ""
  }`;

  async function onValid(values: TransferFields) {
    if (stage === "form") {
      setStage("review");
      return;
    }

    const res = await fetch(`/api/admin/leagues/${leagueId}/transfers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        driver_entry_id: values.driver_entry_id,
        effective_date: resolveEffectiveDate(values.race_session_id, sessions),
        new_team_id: values.new_team_id || null,
        remove_from_league: values.new_team_id ? false : values.remove_from_league,
        transfer_reason: values.transfer_reason || null,
      }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError("root", { message: data.error ?? "Transfer failed" });
      return;
    }

    // P1-style pattern (see ResultStepper) — stay put and show an inline
    // success line instead of an unannounced redirect.
    setStage("success");
  }

  if (stage === "success") {
    return (
      <div
        className="space-y-3 border border-green-700 bg-green-900/10 p-6"
        ref={successRef}
        role="status"
        tabIndex={-1}
      >
        <p className="text-sm font-bold text-green-400">Transfer recorded: {summary}</p>
        <Link
          className="text-xs font-bold uppercase text-f1-white underline hover:text-f1-red"
          href={`/admin/leagues/${leagueId}`}
        >
          Back to league
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onValid)}>
      {stage === "form" && (
        <div className="space-y-6" ref={formRef} tabIndex={-1}>
          <div className="space-y-2">
            <Label htmlFor="driver_entry_id">Driver</Label>
            <select
              aria-describedby={errors.driver_entry_id ? "driver_entry_id-error" : undefined}
              aria-invalid={!!errors.driver_entry_id}
              className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
              id="driver_entry_id"
              {...register("driver_entry_id")}
            >
              <option value="">Select driver…</option>
              {drivers.map((d) => (
                <option key={d.entryId} value={d.entryId}>
                  {d.name} ({d.teamName})
                </option>
              ))}
            </select>
            {errors.driver_entry_id && (
              <p className="text-xs text-f1-red" id="driver_entry_id-error">{errors.driver_entry_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="race_session_id">Effective From</Label>
            <select
              aria-describedby={errors.race_session_id ? "race_session_id-error" : undefined}
              aria-invalid={!!errors.race_session_id}
              className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
              id="race_session_id"
              {...register("race_session_id")}
            >
              <option value="">Select last race for the old team…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
              <option value={IMMEDIATE_VALUE}>Effective immediately (no completed race boundary)</option>
            </select>
            {errors.race_session_id && (
              <p className="text-xs text-f1-red" id="race_session_id-error">{errors.race_session_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_team_id">New Team (leave blank for free agent)</Label>
            <select
              aria-describedby={errors.new_team_id ? "new_team_id-error" : undefined}
              aria-invalid={!!errors.new_team_id}
              className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
              id="new_team_id"
              {...register("new_team_id", { setValueAs: (v: string) => v || null })}
            >
              <option value="">— Free agent (no team) —</option>
              {teams.map((t) => {
                const full = t.primaryCount >= MAX_PRIMARY_DRIVERS_PER_TEAM;
                // Reserve slots aren't capped, so a reserve driver can still
                // join a "full" team (M10a).
                const disableOption = full && !selectedDriver?.isReserve;
                return (
                  <option disabled={disableOption} key={t.id} value={t.id}>
                    {t.name} ({t.primaryCount}/{MAX_PRIMARY_DRIVERS_PER_TEAM}{full ? " — full" : ""})
                  </option>
                );
              })}
            </select>
            {errors.new_team_id && (
              <p className="text-xs text-f1-red" id="new_team_id-error">{errors.new_team_id.message}</p>
            )}
          </div>

          {!newTeamId && (
            <div className="space-y-1">
              <label className="flex items-center gap-3 text-sm text-f1-white">
                <input className="accent-f1-red" type="checkbox" {...register("remove_from_league")} />
                Also remove driver from the league roster
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="transfer_reason">Reason (optional)</Label>
            <Input
              aria-describedby={errors.transfer_reason ? "transfer_reason-error" : undefined}
              aria-invalid={!!errors.transfer_reason}
              id="transfer_reason"
              maxLength={240}
              placeholder="e.g. Season swap"
              {...register("transfer_reason")}
            />
            {errors.transfer_reason && (
              <p className="text-xs text-f1-red" id="transfer_reason-error">{errors.transfer_reason.message}</p>
            )}
          </div>
        </div>
      )}

      {stage === "review" && (
        <div
          className="space-y-2 border border-f1-border bg-f1-dark p-4"
          ref={reviewRef}
          tabIndex={-1}
        >
          <p className="text-xs font-bold uppercase text-f1-muted">Review Transfer</p>
          <p className="text-sm text-f1-white">{summary}</p>
        </div>
      )}

      <FormError message={errors.root?.message} />

      <div className="flex gap-3">
        {stage === "review" && (
          <button
            className="border border-f1-border px-4 py-2 text-sm font-bold uppercase text-f1-muted transition-colors hover:border-f1-white hover:text-f1-white"
            onClick={() => setStage("form")}
            type="button"
          >
            Back
          </button>
        )}
        <button
          className="flex-1 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting || !csrfToken}
          type="submit"
        >
          {stage === "form" ? "Review Transfer" : isSubmitting ? "Submitting…" : "Confirm Transfer"}
        </button>
      </div>
    </form>
  );
}
