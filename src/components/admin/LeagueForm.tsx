"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const leagueSchema = z.object({
  constructor_championship_enabled: z.boolean(),
  fastest_lap_enabled: z.boolean(),
  format: z.enum(["informal", "standard", "custom"]),
  name: z.string().trim().min(1, "Name is required").max(100),
  penalty_threshold: z.number().int().min(1).max(99),
  pole_position_enabled: z.boolean(),
  season_id: z.string().uuid("Please select a season"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens only"),
});

type LeagueFields = z.infer<typeof leagueSchema>;

interface Season {
  id: string;
  name: string;
}

interface LeagueFormProps {
  seasons: Season[];
}

export function LeagueForm({ seasons }: LeagueFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
    watch,
  } = useForm<LeagueFields>({
    defaultValues: {
      constructor_championship_enabled: true,
      fastest_lap_enabled: true,
      format: "standard",
      penalty_threshold: 12,
      pole_position_enabled: false,
    },
    resolver: zodResolver(leagueSchema),
  });

  // Auto-generate slug from name
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setValue("slug", slug, { shouldValidate: false });
  }

  async function onSubmit(values: LeagueFields) {
    const res = await fetch("/api/admin/leagues", {
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
        message: (body as { error?: string }).error ?? "Failed to create league.",
      });
      return;
    }

    const { league } = await res.json() as { league: { id: string } };
    router.push(`/admin/leagues/${league.id}`);
    router.refresh();
  }

  const format = watch("format");

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {seasons.length === 0 && (
        <p className="border border-f1-red bg-f1-dark p-3 text-sm text-f1-silver">
          No seasons exist yet.{" "}
          <a className="text-f1-red underline" href="/admin/seasons">
            Create a season first.
          </a>
        </p>
      )}

      {/* Season */}
      <div className="space-y-1">
        <Label htmlFor="league-season">Season</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="league-season"
          {...register("season_id")}
        >
          <option value="">Select a season…</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {errors.season_id && (
          <p className="text-xs text-destructive">{errors.season_id.message}</p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="league-name">Name</Label>
        <Input
          id="league-name"
          placeholder="Standard League"
          {...register("name", { onChange: handleNameChange })}
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1">
        <Label htmlFor="league-slug">Slug</Label>
        <Input
          id="league-slug"
          placeholder="standard-league"
          {...register("slug")}
          className="bg-f1-dark font-mono text-f1-white placeholder:text-f1-muted"
        />
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        )}
      </div>

      {/* Format */}
      <div className="space-y-1">
        <Label htmlFor="league-format">Format</Label>
        <select
          className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
          id="league-format"
          {...register("format")}
        >
          <option value="informal">Informal (2 × 25% races)</option>
          <option value="standard">Standard (50% feature race)</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Feature flags */}
      <fieldset className="space-y-2 border border-f1-border p-4">
        <legend className="px-2 text-xs font-bold uppercase text-f1-muted">
          Scoring Options
        </legend>
        <label className="flex items-center gap-3 text-sm text-f1-white">
          <input
            className="accent-f1-red"
            type="checkbox"
            {...register("fastest_lap_enabled")}
          />
          Fastest lap bonus
        </label>
        <label className="flex items-center gap-3 text-sm text-f1-white">
          <input
            className="accent-f1-red"
            type="checkbox"
            {...register("pole_position_enabled")}
          />
          Pole position bonus
        </label>
        <label className="flex items-center gap-3 text-sm text-f1-white">
          <input
            className="accent-f1-red"
            type="checkbox"
            {...register("constructor_championship_enabled")}
          />
          Constructors championship
        </label>
      </fieldset>

      {/* Penalty threshold */}
      <div className="space-y-1">
        <Label htmlFor="league-penalty">Penalty point threshold</Label>
        <Input
          id="league-penalty"
          max={99}
          min={1}
          type="number"
          {...register("penalty_threshold", { valueAsNumber: true })}
          className="bg-f1-dark text-f1-white"
        />
        <p className="text-xs text-f1-muted">
          Alert is shown when a driver reaches this total.
        </p>
        {errors.penalty_threshold && (
          <p className="text-xs text-destructive">{errors.penalty_threshold.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}

      <button
        className="w-full border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={isSubmitting || seasons.length === 0}
        type="submit"
      >
        {isSubmitting ? "Creating…" : "Create League"}
      </button>
    </form>
  );
}
