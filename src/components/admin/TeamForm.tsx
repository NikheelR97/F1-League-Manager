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

const teamSchema = z.object({
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex colour like #FF0000"),
  kind: z.enum(["official", "custom"]),
  name: z.string().trim().min(1, "Name is required").max(100),
  official_template_id: z.string().uuid().nullable().optional(),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens only"),
});

type TeamFields = z.infer<typeof teamSchema>;

interface OfficialTemplate {
  color_hex: string;
  id: string;
  name: string;
  slug: string;
}

interface InitialTeam {
  color_hex: string;
  id: string;
  kind: "custom" | "official";
  name: string;
  slug: string;
}

interface TeamFormProps {
  initialTeam?: InitialTeam;
  leagueId: string;
  officialTemplates?: OfficialTemplate[];
}

export function TeamForm({ initialTeam, leagueId, officialTemplates = [] }: TeamFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const isEdit = Boolean(initialTeam);
  const [kind, setKind] = useState<"custom" | "official">(initialTeam?.kind ?? "custom");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<TeamFields>({
    defaultValues: initialTeam
      ? { ...initialTeam, official_template_id: null }
      : {
          color_hex: "#E8002D",
          kind: "custom",
          official_template_id: null,
        },
    resolver: zodResolver(teamSchema),
  });

  function handleKindChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value as "custom" | "official";
    setKind(next);
    if (next === "custom") {
      setValue("official_template_id", null);
    }
  }

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setValue("official_template_id", id || null);
    if (!id) return;
    const tpl = officialTemplates.find((t) => t.id === id);
    if (!tpl) return;
    setValue("name", tpl.name, { shouldValidate: false });
    setValue("color_hex", tpl.color_hex, { shouldValidate: false });
    setValue("slug", tpl.slug, { shouldValidate: false });
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setValue("slug", slug, { shouldValidate: false });
  }

  async function onSubmit(values: TeamFields) {
    const url = isEdit
      ? `/api/admin/leagues/${leagueId}/teams/${initialTeam!.id}`
      : `/api/admin/leagues/${leagueId}/teams`;
    // PATCH only accepts name/slug/colour — kind is fixed after creation.
    const body = isEdit
      ? { color_hex: values.color_hex, name: values.name, slug: values.slug }
      : values;
    const res = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: isEdit ? "PATCH" : "POST",
    });

    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError("root", {
        message:
          (resBody as { error?: string }).error ??
          `Failed to ${isEdit ? "save" : "create"} team`,
      });
      return;
    }

    router.push(`/admin/leagues/${leagueId}`);
    router.refresh();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {/* Kind — fixed after creation, not editable */}
      {!isEdit && (
        <div className="space-y-1">
          <Label>Team type</Label>
          <div className="flex gap-4">
            {(["custom", "official"] as const).map((k) => (
              <label className="flex items-center gap-2 text-sm text-f1-white" key={k}>
                <input
                  className="accent-f1-red"
                  type="radio"
                  value={k}
                  {...register("kind", { onChange: handleKindChange })}
                />
                {k === "official" ? "Official F1 team" : "Custom team"}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Official template picker */}
      {!isEdit && kind === "official" && (
        <div className="space-y-1">
          <Label htmlFor="team-template">Official template</Label>
          <select
            className="w-full border border-f1-border bg-f1-dark px-3 py-2 text-sm text-f1-white focus:border-f1-red focus:outline-none"
            id="team-template"
            {...register("official_template_id", { onChange: handleTemplateChange })}
          >
            <option value="">Select a template…</option>
            {officialTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="team-name">Name</Label>
        <Input
          id="team-name"
          placeholder="Red Bull Racing"
          {...register("name", isEdit ? {} : { onChange: handleNameChange })}
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1">
        <Label htmlFor="team-slug">Slug</Label>
        <Input
          id="team-slug"
          placeholder="red-bull-racing"
          {...register("slug")}
          className="bg-f1-dark font-mono text-f1-white placeholder:text-f1-muted"
        />
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        )}
      </div>

      {/* Colour */}
      <div className="space-y-1">
        <Label htmlFor="team-color">Team colour</Label>
        <div className="flex items-center gap-3">
          <input
            className="h-9 w-12 cursor-pointer rounded-none border border-f1-border bg-f1-dark p-1"
            id="team-color"
            type="color"
            {...register("color_hex")}
          />
          <Input
            aria-label="Hex colour code"
            placeholder="#E8002D"
            {...register("color_hex")}
            className="font-mono bg-f1-dark text-f1-white placeholder:text-f1-muted"
          />
        </div>
        {errors.color_hex && (
          <p className="text-xs text-destructive">{errors.color_hex.message}</p>
        )}
      </div>

      <FormError message={errors.root?.message} />

      <button
        className="w-full min-h-11 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting
          ? isEdit
            ? "Saving…"
            : "Creating…"
          : isEdit
            ? "Save Changes"
            : "Create Team"}
      </button>
    </form>
  );
}
