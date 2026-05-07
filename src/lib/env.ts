import "server-only";

import { z } from "zod";

const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .or(z.literal(""))
  .optional();

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().trim().url(),
});

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  CSRF_SECRET: z.string().trim().length(64),
  UPSTASH_REDIS_REST_URL: optionalUrlSchema,
  UPSTASH_REDIS_REST_TOKEN: z.string().trim().optional(),
  SENTRY_DSN: optionalUrlSchema,
  SENTRY_AUTH_TOKEN: z.string().trim().optional(),
  DISCORD_WEBHOOK_URL: optionalUrlSchema,
  SUPABASE_STORAGE_ASSET_BUCKET: z.string().trim().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

type EnvSource = Record<string, string | undefined>;

export function readPublicEnv(source: EnvSource = process.env): PublicEnv {
  return publicEnvSchema.parse(source);
}

export function readServerEnv(source: EnvSource = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}
