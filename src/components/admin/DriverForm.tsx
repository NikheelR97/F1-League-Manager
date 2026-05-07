"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const driverSchema = z.object({
  country: z.string().trim().min(2).max(80).nullable().optional(),
  display_name: z.string().trim().min(1, "Name is required").max(80),
  racing_number: z.number().int().min(1).max(999).nullable().optional(),
});

type DriverFields = z.infer<typeof driverSchema>;

export function DriverForm() {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<DriverFields>({
    defaultValues: {
      country: null,
      display_name: "",
      racing_number: null,
    },
    resolver: zodResolver(driverSchema),
  });

  async function onSubmit(values: DriverFields) {
    const res = await fetch("/api/admin/drivers", {
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
        message: (body as { error?: string }).error ?? "Failed to create driver.",
      });
      return;
    }

    router.push("/admin/drivers");
    router.refresh();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="driver-name">Display name</Label>
        <Input
          id="driver-name"
          placeholder="Max Verstappen"
          {...register("display_name")}
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
        />
        {errors.display_name && (
          <p className="text-xs text-destructive">{errors.display_name.message}</p>
        )}
      </div>

      {/* Racing number */}
      <div className="space-y-1">
        <Label htmlFor="driver-number">Racing number</Label>
        <Input
          id="driver-number"
          max={999}
          min={1}
          placeholder="1"
          type="number"
          {...register("racing_number", { valueAsNumber: true })}
          className="bg-f1-dark font-mono text-f1-white placeholder:text-f1-muted"
        />
        {errors.racing_number && (
          <p className="text-xs text-destructive">{errors.racing_number.message}</p>
        )}
      </div>

      {/* Country */}
      <div className="space-y-1">
        <Label htmlFor="driver-country">Country</Label>
        <Input
          id="driver-country"
          placeholder="Netherlands"
          {...register("country")}
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
        />
        {errors.country && (
          <p className="text-xs text-destructive">{errors.country.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}

      <button
        className="w-full border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Creating…" : "Create Driver"}
      </button>
    </form>
  );
}
