import { z } from "zod";

import {
  DUPLICATE_SETUP_SUFFIX,
  MAX_SETUP_META_LENGTH,
  MAX_SETUP_NAME_LENGTH,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Zod schemas — used in API routes and re-exported for tests
// ---------------------------------------------------------------------------

export const createSetupSchema = z.object({
  driver_id: z.string().uuid(),
  circuit_id: z.string().uuid(),
  name: z.string().trim().min(1).max(MAX_SETUP_NAME_LENGTH),
  game_version: z.string().trim().max(MAX_SETUP_META_LENGTH).optional(),
  weather: z.string().trim().max(MAX_SETUP_META_LENGTH).optional(),
  is_public: z.boolean().default(false),
  league_id: z.string().uuid().optional(),
  setup_data: z.record(z.string(), z.unknown()),
});

export const updateSetupSchema = z.object({
  circuit_id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(MAX_SETUP_NAME_LENGTH).optional(),
  game_version: z.string().trim().max(MAX_SETUP_META_LENGTH).nullish(),
  weather: z.string().trim().max(MAX_SETUP_META_LENGTH).nullish(),
  is_public: z.boolean().optional(),
  league_id: z.string().uuid().nullish(),
  setup_data: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSetupInput = z.infer<typeof createSetupSchema>;
export type UpdateSetupInput = z.infer<typeof updateSetupSchema>;

// ---------------------------------------------------------------------------
// Ownership check — server-side, separate from RLS
// ---------------------------------------------------------------------------

interface DriverRow {
  id: string;
  profile_id: string | null;
}

export function verifySetupOwnership(
  setup: { driver_id: string } | null,
  driverRows: DriverRow[],
): boolean {
  if (!setup) return false;
  return driverRows.some((d) => d.id === setup.driver_id);
}

// ---------------------------------------------------------------------------
// Duplicate name helper
// ---------------------------------------------------------------------------

export function buildDuplicateName(originalName: string): string {
  const base = originalName.slice(0, MAX_SETUP_NAME_LENGTH - DUPLICATE_SETUP_SUFFIX.length);
  return `${base}${DUPLICATE_SETUP_SUFFIX}`;
}
