import "server-only";

import { z } from "zod";

import { publicEnvSchema, readPublicEnv } from "@/lib/env-public";

const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .or(z.literal(""))
  .optional();

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  CSRF_SECRET: z.string().trim().length(64),
  UPSTASH_REDIS_REST_URL: optionalUrlSchema,
  UPSTASH_REDIS_REST_TOKEN: z.string().trim().optional(),
  SENTRY_DSN: optionalUrlSchema,
  SENTRY_AUTH_TOKEN: z.string().trim().optional(),
  DISCORD_WEBHOOK_URL: optionalUrlSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

type EnvSource = Record<string, string | undefined>;

export { readPublicEnv };

export function readServerEnv(source: EnvSource = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}
