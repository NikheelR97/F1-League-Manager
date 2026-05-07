"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_POINTS_POSITIONS, STANDARD_POINTS } from "@/lib/constants";
import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

const positionsSchema = z
  .record(z.string(), z.number().int().min(0).max(999))
  .refine((v) => Object.keys(v).length > 0, { message: "At least one position required" });

const pointsSystemSchema = z.object({
  fastest_lap_points: z.number().int().min(0).max(10),
  max_positions: z.number().int().min(1).max(MAX_POINTS_POSITIONS),
  name: z.string().trim().min(1, "Name is required").max(80),
  points_by_position: positionsSchema,
  pole_position_points: z.number().int().min(0).max(10),
});

type PointsSystemFields = z.infer<typeof pointsSystemSchema>;

interface PointsSystemFormProps {
  leagueId: string;
}

const MAX_EDITABLE_POSITIONS = 10;

export function PointsSystemForm({ leagueId }: PointsSystemFormProps) {
  const router = useRouter();
  const csrfToken = useCsrfToken();

  // Local state: array of {position, points} pairs for the position editor
  const [rows, setRows] = useState<Array<{ points: number; position: number }>>(
    Object.entries(STANDARD_POINTS).map(([pos, pts]) => ({
      points: pts,
      position: Number(pos),
    })),
  );

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<PointsSystemFields>({
    defaultValues: {
      fastest_lap_points: 1,
      max_positions: 10,
      name: "Standard F1 Points",
      pole_position_points: 0,
    },
    resolver: zodResolver(pointsSystemSchema),
  });

  function applyStandardPoints() {
    setRows(
      Object.entries(STANDARD_POINTS).map(([pos, pts]) => ({
        points: pts,
        position: Number(pos),
      })),
    );
  }

  function updateRow(index: number, field: "points" | "position", value: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    if (rows.length >= MAX_EDITABLE_POSITIONS) return;
    const nextPos = rows.length > 0 ? Math.max(...rows.map((r) => r.position)) + 1 : 1;
    setRows((prev) => [...prev, { points: 0, position: nextPos }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(values: PointsSystemFields) {
    // Build points_by_position from rows
    const points_by_position: Record<string, number> = {};
    for (const { points, position } of rows) {
      if (position > 0) {
        points_by_position[String(position)] = points;
      }
    }

    const payload = { ...values, points_by_position };
    const res = await fetch(`/api/admin/leagues/${leagueId}/points-systems`, {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
      },
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError("root", {
        message: (body as { error?: string }).error ?? "Failed to create points system.",
      });
      return;
    }

    router.push(`/admin/leagues/${leagueId}`);
    router.refresh();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="ps-name">Name</Label>
        <Input
          id="ps-name"
          placeholder="Standard F1 Points"
          {...register("name")}
          className="bg-f1-dark text-f1-white placeholder:text-f1-muted"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Points by position editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Points by position</Label>
          <button
            className="text-xs text-f1-red underline"
            onClick={applyStandardPoints}
            type="button"
          >
            Use F1 standard
          </button>
        </div>
        <div className="space-y-1">
          {rows.map((row, i) => (
            <div className="flex items-center gap-2" key={i}>
              <span className="w-6 text-right font-mono text-xs text-f1-muted">
                {row.position}
              </span>
              <span className="text-xs text-f1-muted">P</span>
              <Input
                aria-label={`Points for position ${row.position}`}
                className="w-20 bg-f1-dark font-mono text-f1-white"
                min={0}
                onChange={(e) => updateRow(i, "points", Number(e.target.value))}
                type="number"
                value={row.points}
              />
              <button
                aria-label={`Remove position ${row.position}`}
                className="text-xs text-f1-muted hover:text-destructive"
                onClick={() => removeRow(i)}
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {rows.length < MAX_EDITABLE_POSITIONS && (
          <button
            className="text-xs text-f1-muted underline hover:text-f1-white"
            onClick={addRow}
            type="button"
          >
            + Add position
          </button>
        )}
      </div>

      {/* Bonus points */}
      <fieldset className="space-y-3 border border-f1-border p-4">
        <legend className="px-2 text-xs font-bold uppercase text-f1-muted">
          Bonus points
        </legend>
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <Label htmlFor="ps-fl">Fastest lap</Label>
            <Input
              id="ps-fl"
              max={10}
              min={0}
              type="number"
              {...register("fastest_lap_points", { valueAsNumber: true })}
              className="w-20 bg-f1-dark font-mono text-f1-white"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ps-pole">Pole position</Label>
            <Input
              id="ps-pole"
              max={10}
              min={0}
              type="number"
              {...register("pole_position_points", { valueAsNumber: true })}
              className="w-20 bg-f1-dark font-mono text-f1-white"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ps-max">Paid positions</Label>
            <Input
              id="ps-max"
              max={MAX_POINTS_POSITIONS}
              min={1}
              type="number"
              {...register("max_positions", { valueAsNumber: true })}
              className="w-20 bg-f1-dark font-mono text-f1-white"
            />
          </div>
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
        {isSubmitting ? "Creating…" : "Create Points System"}
      </button>
    </form>
  );
}
