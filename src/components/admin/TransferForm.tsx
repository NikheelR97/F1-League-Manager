"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const transferSchema = z.object({
  driver_entry_id: z.string().uuid("Select a driver"),
  effective_date: z.string().date("Enter a valid date"),
  new_team_id: z.string().uuid().nullable(),
  transfer_reason: z.string().trim().max(240).optional(),
});

type TransferFields = z.infer<typeof transferSchema>;

interface Driver {
  entryId: string;
  name: string;
  teamName: string;
}

interface Team {
  id: string;
  name: string;
}

interface TransferFormProps {
  drivers: Driver[];
  leagueId: string;
  teams: Team[];
}

export function TransferForm({ drivers, leagueId, teams }: TransferFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<TransferFields>({
    defaultValues: {
      new_team_id: null,
    },
    resolver: zodResolver(transferSchema),
  });

  async function onSubmit(values: TransferFields) {
    const res = await fetch(`/api/admin/leagues/${leagueId}/transfers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        driver_entry_id: values.driver_entry_id,
        effective_date: values.effective_date,
        new_team_id: values.new_team_id || null,
        transfer_reason: values.transfer_reason || null,
      }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError("root", { message: data.error ?? "Transfer failed" });
      return;
    }

    router.push(`/admin/leagues/${leagueId}`);
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="driver_entry_id">Driver</Label>
        <select
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
          <p className="text-xs text-f1-red">{errors.driver_entry_id.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="effective_date">Effective Date</Label>
        <Input
          id="effective_date"
          type="date"
          {...register("effective_date")}
        />
        {errors.effective_date && (
          <p className="text-xs text-f1-red">{errors.effective_date.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_team_id">New Team (leave blank if driver is departing)</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="new_team_id"
          {...register("new_team_id")}
        >
          <option value="">— Driver departing —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {errors.new_team_id && (
          <p className="text-xs text-f1-red">{errors.new_team_id.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="transfer_reason">Reason (optional)</Label>
        <Input
          id="transfer_reason"
          maxLength={240}
          placeholder="e.g. Season swap"
          {...register("transfer_reason")}
        />
        {errors.transfer_reason && (
          <p className="text-xs text-f1-red">{errors.transfer_reason.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-f1-red">{errors.root.message}</p>
      )}

      <button
        className="border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting || !csrfToken}
        type="submit"
      >
        {isSubmitting ? "Submitting…" : "Record Transfer"}
      </button>
    </form>
  );
}
