import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

type EnvSource = Record<string, string | undefined>;

export function readPublicEnv(source: EnvSource = process.env): PublicEnv {
  return publicEnvSchema.parse(source);
}
