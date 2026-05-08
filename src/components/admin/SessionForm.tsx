"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const SESSION_CODE_RE = /^[A-Z0-9]{6}$/;

const formSchema = z.object({
  circuit_id: z.string().min(1, "Please select a circuit"),
  name: z.string().trim().min(1, "Name is required").max(120),
  points_system_id: z.string().min(1, "Please select a points system"),
  race_length_percent: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  race_number: z.union([z.literal(1), z.literal(2)]),
  scheduled_at: z.string().min(1, "Please select a date"),
  session_code: z.string().regex(SESSION_CODE_RE, "Must be exactly 6 uppercase letters or digits"),
});

type FormData = z.infer<typeof formSchema>;

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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      circuit_id: session?.circuit_id ?? initialCircuitId ?? "",
      name: session?.name ?? "",
      points_system_id: session?.points_system_id ?? pointsSystems[0]?.id ?? "",
      race_length_percent: session?.race_length_percent ?? 100,
      race_number: session?.race_number ?? 1,
      scheduled_at: session?.scheduled_at 
        ? new Date(session.scheduled_at).toISOString().slice(0, 16) 
        : "",
      session_code: session?.session_code ?? generateCode(),
    },
  });

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = form;
  const currentName = useWatch({ control, name: "name" });

  function handleCircuitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCircuitId = e.target.value;
    setValue("circuit_id", newCircuitId, { shouldValidate: true });
    
    if (!currentName) {
      const circuit = circuits.find((c) => c.id === newCircuitId);
      if (circuit) setValue("name", `${circuit.name} Race`, { shouldValidate: true });
    }
  }

  async function onSubmit(data: FormData) {
    setSubmitError(null);

    // Validate scheduled_at is a valid datetime
    const parsedDate = z.string().datetime({ offset: true }).safeParse(new Date(data.scheduled_at).toISOString());
    if (!parsedDate.success) {
      setSubmitError("Invalid scheduled date");
      return;
    }

    try {
      const url = session 
        ? `/api/admin/sessions/${session.id}`
        : `/api/admin/leagues/${leagueId}/sessions`;
        
      const res = await fetch(url, {
        body: JSON.stringify({
          ...data,
          scheduled_at: new Date(data.scheduled_at).toISOString(),
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
        setSubmitError((body as { error?: string }).error ?? `Failed to ${session ? "update" : "create"} session.`);
        return;
      }

      router.push(`/admin/leagues/${leagueId}`);
      router.refresh();
    } catch {
      setSubmitError(`Failed to ${session ? "update" : "create"} session.`);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {/* Circuit */}
      <div className="space-y-1">
        <Label htmlFor="circuit">Circuit</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none disabled:opacity-50"
          disabled={!!wheelSpinId}
          id="circuit"
          {...register("circuit_id")}
          onChange={handleCircuitChange}
        >
          <option value="">Select a circuit…</option>
          {circuits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.country})
            </option>
          ))}
        </select>
        {errors.circuit_id && <p className="text-xs text-destructive">{errors.circuit_id.message}</p>}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="session-name">Session name</Label>
        <Input
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
          id="session-name"
          placeholder="Bahrain Race"
          {...register("name")}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
            {...register("session_code", {
              onChange: (e) => setValue("session_code", e.target.value.toUpperCase()),
            })}
          />
          <button
            className="border border-f1-border px-3 py-2 text-xs text-f1-muted hover:border-f1-white hover:text-f1-white"
            type="button"
            onClick={() => setValue("session_code", generateCode(), { shouldValidate: true })}
          >
            Regenerate
          </button>
        </div>
        {errors.session_code && <p className="text-xs text-destructive">{errors.session_code.message}</p>}
      </div>

      {/* Points system */}
      <div className="space-y-1">
        <Label htmlFor="points-system">Points system</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="points-system"
          {...register("points_system_id")}
        >
          {pointsSystems.map((ps) => (
            <option key={ps.id} value={ps.id}>
              {ps.name}
            </option>
          ))}
        </select>
        {errors.points_system_id && <p className="text-xs text-destructive">{errors.points_system_id.message}</p>}
      </div>

      {/* Race number */}
      <div className="space-y-1">
        <Label>Race number</Label>
        <div className="flex gap-4">
          {([1, 2] as const).map((n) => (
            <label className="flex items-center gap-2 text-sm text-f1-white" key={n}>
              <input
                className="accent-f1-red"
                type="radio"
                value={n}
                {...register("race_number", { valueAsNumber: true })}
              />
              Race {n} {n === 2 ? "(Sprint)" : "(Feature)"}
            </label>
          ))}
        </div>
        {errors.race_number && <p className="text-xs text-destructive">{errors.race_number.message}</p>}
      </div>

      {/* Race length */}
      <div className="space-y-1">
        <Label>Race length</Label>
        <div className="flex gap-4">
          {([25, 50, 100] as const).map((pct) => (
            <label className="flex items-center gap-2 text-sm text-f1-white" key={pct}>
              <input
                className="accent-f1-red"
                type="radio"
                value={pct}
                {...register("race_length_percent", { valueAsNumber: true })}
              />
              {pct}%
            </label>
          ))}
        </div>
        {errors.race_length_percent && <p className="text-xs text-destructive">{errors.race_length_percent.message}</p>}
      </div>

      {/* Scheduled at */}
      <div className="space-y-1">
        <Label htmlFor="scheduled-at">Scheduled date &amp; time</Label>
        <Input
          className="bg-f1-dark text-f1-white"
          id="scheduled-at"
          type="datetime-local"
          {...register("scheduled_at")}
        />
        {errors.scheduled_at && <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>}
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <button
        className="w-full border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (session ? "Updating…" : "Creating…") : (session ? "Update Session" : "Create Session")}
      </button>
    </form>
  );
}
