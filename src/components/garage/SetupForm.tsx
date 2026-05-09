"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_SETUP_META_LENGTH, MAX_SETUP_NAME_LENGTH } from "@/lib/constants";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

// Client-side schema uses JSON string for setup_data then transforms it
const formSchema = z.object({
  driver_id: z.string().min(1, "Please select a driver"),
  circuit_id: z.string().min(1, "Please select a circuit"),
  name: z.string().trim().min(1, "Name is required").max(MAX_SETUP_NAME_LENGTH),
  game_version: z.string().trim().max(MAX_SETUP_META_LENGTH).optional(),
  weather: z.string().trim().max(MAX_SETUP_META_LENGTH).optional(),
  is_public: z.boolean(),
  league_id: z.string().optional(),
  setup_data_raw: z.string().min(1, "Setup data is required").superRefine((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Setup data must be a JSON object" });
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid JSON" });
    }
  }),
});

type FormData = z.infer<typeof formSchema>;

interface Circuit {
  country: string;
  id: string;
  name: string;
}

interface Driver {
  id: string;
  display_name: string;
}

interface League {
  id: string;
  name: string;
}

interface SetupFormProps {
  circuits: Circuit[];
  drivers: Driver[];
  leagues: League[];
  setupId?: string;
  defaultValues?: Partial<FormData> & { setup_data_raw?: string };
}

export function SetupForm({ circuits, drivers, leagues, setupId, defaultValues }: SetupFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      driver_id: "",
      circuit_id: "",
      name: "",
      game_version: "",
      weather: "",
      is_public: false,
      league_id: "",
      setup_data_raw: "{}",
      ...defaultValues,
    },
  });

  async function onSubmit(values: FormData) {
    setServerError(null);
    const setupData = JSON.parse(values.setup_data_raw) as Record<string, unknown>;

    const payload = {
      driver_id: values.driver_id,
      circuit_id: values.circuit_id,
      name: values.name,
      game_version: values.game_version || undefined,
      weather: values.weather || undefined,
      is_public: values.is_public,
      league_id: values.league_id || undefined,
      setup_data: setupData,
    };

    const url = setupId ? `/api/racer/setups/${setupId}` : "/api/racer/setups";
    const method = setupId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(setupId ? { ...payload, driver_id: undefined } : payload),
    });

    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setServerError(body.error ?? "Something went wrong");
      return;
    }

    router.push("/garage");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      {serverError && (
        <p className="border border-f1-red bg-black/20 px-4 py-2 text-sm text-f1-red">
          {serverError}
        </p>
      )}

      {/* Driver — only shown on create */}
      {!setupId && (
        <div className="space-y-1">
          <Label htmlFor="driver_id">Driver</Label>
          <select
            className="w-full border border-f1-border bg-f1-black px-3 py-2 text-sm text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
            id="driver_id"
            {...register("driver_id")}
          >
            <option value="">Select driver</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>
          {errors.driver_id && (
            <p className="text-xs text-f1-red">{errors.driver_id.message}</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="name">Setup Name</Label>
        <Input
          className="border-f1-border bg-f1-black text-f1-white"
          id="name"
          placeholder="e.g. Monaco Qualifying Attempt"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-f1-red">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="circuit_id">Circuit</Label>
        <select
          className="w-full border border-f1-border bg-f1-black px-3 py-2 text-sm text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
          id="circuit_id"
          {...register("circuit_id")}
        >
          <option value="">Select circuit</option>
          {circuits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.country}
            </option>
          ))}
        </select>
        {errors.circuit_id && (
          <p className="text-xs text-f1-red">{errors.circuit_id.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="game_version">Game Version</Label>
          <Input
            className="border-f1-border bg-f1-black text-f1-white"
            id="game_version"
            placeholder="e.g. F1 25 v1.5"
            {...register("game_version")}
          />
          {errors.game_version && (
            <p className="text-xs text-f1-red">{errors.game_version.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="weather">Weather</Label>
          <select
            className="w-full border border-f1-border bg-f1-black px-3 py-2 text-sm text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
            id="weather"
            {...register("weather")}
          >
            <option value="">Any / unspecified</option>
            <option value="Dry">Dry</option>
            <option value="Wet">Wet</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>
      </div>

      {leagues.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="league_id">League (optional)</Label>
          <select
            className="w-full border border-f1-border bg-f1-black px-3 py-2 text-sm text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
            id="league_id"
            {...register("league_id")}
          >
            <option value="">No league</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="setup_data_raw">Setup Data (JSON)</Label>
        <textarea
          className="h-48 w-full border border-f1-border bg-f1-black px-3 py-2 font-mono text-xs text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
          id="setup_data_raw"
          placeholder='{ "front_wing": 8, "rear_wing": 3, ... }'
          {...register("setup_data_raw")}
        />
        {errors.setup_data_raw && (
          <p className="text-xs text-f1-red">{errors.setup_data_raw.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          className="h-4 w-4 accent-f1-red"
          id="is_public"
          type="checkbox"
          {...register("is_public")}
        />
        <Label className="cursor-pointer" htmlFor="is_public">
          Make this setup public
        </Label>
      </div>

      <div className="flex items-center gap-4 border-t border-f1-border pt-4">
        <button
          className="border border-f1-red bg-f1-red px-6 py-2 text-sm font-bold uppercase text-f1-white transition-colors hover:bg-transparent disabled:opacity-50"
          disabled={isSubmitting || !csrfToken}
          type="submit"
        >
          {isSubmitting ? "Saving…" : setupId ? "Save Changes" : "Create Setup"}
        </button>
        <button
          className="border border-f1-border px-6 py-2 text-sm font-bold uppercase text-f1-muted transition-colors hover:text-f1-white"
          onClick={() => router.push("/garage")}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
