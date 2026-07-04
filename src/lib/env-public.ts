import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

type EnvSource = Record<string, string | undefined>;

export function readPublicEnv(source: EnvSource = process.env): PublicEnv {
  // Vercel Preview deployments get a unique URL every deploy, so a fixed
  // NEXT_PUBLIC_SITE_URL can never match. Fall back to Vercel's own
  // per-deployment URL (auto-exposed, no config needed) when unset —
  // explicit config (required for prod's stable custom domain) still wins.
  const fallbackSiteUrl = source.NEXT_PUBLIC_VERCEL_URL
    ? `https://${source.NEXT_PUBLIC_VERCEL_URL}`
    : undefined;

  return publicEnvSchema.parse({
    ...source,
    NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl,
  });
}
