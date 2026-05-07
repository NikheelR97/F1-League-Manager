"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const addDriverSchema = z.object({
  carry_over_ban_count: z.number().int().min(0),
  carry_over_penalty_points: z.number().int().min(0),
  driver_id: z.string().uuid("Please select a driver"),
  is_reserve: z.boolean(),
  joined_on: z.string().date("Valid date required"),
  team_id: z.string().uuid("Please select a team"),
});

type AddDriverFields = z.infer<typeof addDriverSchema>;

interface Driver {
  display_name: string;
  id: string;
  racing_number: number | null;
}

interface Team {
  color_hex: string;
  id: string;
  name: string;
}

interface AddLeagueDriverFormProps {
  drivers: Driver[];
  leagueId: string;
  teams: Team[];
}

export function AddLeagueDriverForm({ drivers, leagueId, teams }: AddLeagueDriverFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<AddDriverFields>({
    defaultValues: {
      carry_over_ban_count: 0,
      carry_over_penalty_points: 0,
      is_reserve: false,
      joined_on: new Date().toISOString().slice(0, 10),
    },
    resolver: zodResolver(addDriverSchema),
  });

  async function onSubmit(values: AddDriverFields) {
    const res = await fetch(`/api/admin/leagues/${leagueId}/drivers`, {
      body: JSON.stringify(values),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError("root", {
        message: (body as { error?: string }).error ?? "Failed to add driver.",
      });
      return;
    }

    router.push(`/admin/leagues/${leagueId}`);
    router.refresh();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {/* Driver */}
      <div className="space-y-1">
        <Label htmlFor="entry-driver">Driver</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="entry-driver"
          {...register("driver_id")}
        >
          <option value="">Select a driver…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.display_name}
              {d.racing_number ? ` (#${d.racing_number})` : ""}
            </option>
          ))}
        </select>
        {errors.driver_id && (
          <p className="text-xs text-destructive">{errors.driver_id.message}</p>
        )}
      </div>

      {/* Team */}
      <div className="space-y-1">
        <Label htmlFor="entry-team">Team</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="entry-team"
          {...register("team_id")}
        >
          <option value="">Select a team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {errors.team_id && (
          <p className="text-xs text-destructive">{errors.team_id.message}</p>
        )}
      </div>

      {/* Role */}
      <div className="space-y-1">
        <label className="flex items-center gap-3 text-sm text-f1-white">
          <input
            className="accent-f1-red"
            type="checkbox"
            {...register("is_reserve")}
          />
          Reserve driver (uncheck for primary)
        </label>
      </div>

      {/* Joined on */}
      <div className="space-y-1">
        <Label htmlFor="entry-joined">Joined on</Label>
        <Input
          id="entry-joined"
          type="date"
          {...register("joined_on")}
          className="bg-f1-dark text-f1-white"
        />
        {errors.joined_on && (
          <p className="text-xs text-destructive">{errors.joined_on.message}</p>
        )}
      </div>

      {/* Carry-over fields */}
      <fieldset className="space-y-3 border border-f1-border p-4">
        <legend className="px-2 text-xs font-bold uppercase text-f1-muted">
          Carry-over (from previous season)
        </legend>
        <div className="space-y-1">
          <Label htmlFor="entry-penalty-pts">Penalty points</Label>
          <Input
            id="entry-penalty-pts"
            min={0}
            type="number"
            {...register("carry_over_penalty_points", { valueAsNumber: true })}
            className="bg-f1-dark font-mono text-f1-white"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="entry-bans">Unserved bans</Label>
          <Input
            id="entry-bans"
            min={0}
            type="number"
            {...register("carry_over_ban_count", { valueAsNumber: true })}
            className="bg-f1-dark font-mono text-f1-white"
          />
        </div>
      </fieldset>

      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}

      <button
        className="w-full border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Adding…" : "Add to League"}
      </button>
    </form>
  );
}
