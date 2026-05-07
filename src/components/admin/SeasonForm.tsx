"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const seasonSchema = z.object({
  ends_on: z.string().date().or(z.literal("")).optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  starts_on: z.string().date("Required"),
});

type SeasonFields = z.infer<typeof seasonSchema>;

export function SeasonForm() {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<SeasonFields>({ resolver: zodResolver(seasonSchema) });

  async function onSubmit(values: SeasonFields) {
    const payload = { ...values, ends_on: values.ends_on || null };
    const res = await fetch("/api/admin/seasons", {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "POST",
    });

    if (!res.ok) {
      setError("root", { message: "Failed to create season. Try again." });
      return;
    }

    router.refresh();
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1">
        <Label htmlFor="season-name">Name</Label>
        <Input
          id="season-name"
          placeholder="Season 3"
          {...register("name")}
          aria-describedby={errors.name ? "season-name-error" : undefined}
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
        />
        {errors.name && (
          <p className="text-xs text-destructive" id="season-name-error">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="season-starts">Start Date</Label>
        <Input
          id="season-starts"
          type="date"
          {...register("starts_on")}
          aria-describedby={errors.starts_on ? "season-starts-error" : undefined}
          className="bg-f1-dark text-f1-white"
        />
        {errors.starts_on && (
          <p className="text-xs text-destructive" id="season-starts-error">
            {errors.starts_on.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="season-ends">End Date (optional)</Label>
        <Input
          id="season-ends"
          type="date"
          {...register("ends_on")}
          className="bg-f1-dark text-f1-white"
        />
      </div>

      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}

      <button
        className="w-full border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Creating…" : "Create Season"}
      </button>
    </form>
  );
}
