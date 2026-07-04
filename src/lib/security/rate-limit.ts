import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  ADMIN_RATE_LIMIT_REQUESTS,
  ADMIN_RATE_LIMIT_WINDOW,
  AUTH_RATE_LIMIT_REQUESTS,
  AUTH_RATE_LIMIT_WINDOW,
} from "@/lib/constants";

interface RateLimitEnv {
  [key: string]: string | undefined;
  E2E_SESSION_ENABLED?: string;
  NODE_ENV?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
}

function isProduction(env: RateLimitEnv): boolean {
  return env.NODE_ENV === "production";
}

function createRedis(env: RateLimitEnv): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    // E2E runs a production build (`next start`) locally without Upstash
    // configured. E2E_SESSION_ENABLED already marks that controlled case
    // for /api/e2e/session — reuse it here instead of failing every
    // admin mutation in the local E2E suite.
    if (isProduction(env) && env.E2E_SESSION_ENABLED !== "true") {
      throw new Error("Rate limiting requires Upstash Redis in production");
    }

    return null;
  }

  return new Redis({
    token: env.UPSTASH_REDIS_REST_TOKEN,
    url: env.UPSTASH_REDIS_REST_URL,
  });
}

export function createAdminRateLimiter(env: RateLimitEnv = process.env) {
  const redis = createRedis(env);
  if (!redis) {
    return null;
  }

  return new Ratelimit({
    limiter: Ratelimit.slidingWindow(
      ADMIN_RATE_LIMIT_REQUESTS,
      ADMIN_RATE_LIMIT_WINDOW,
    ),
    redis,
  });
}

export function createAuthRateLimiter(env: RateLimitEnv = process.env) {
  const redis = createRedis(env);
  if (!redis) {
    return null;
  }

  return new Ratelimit({
    limiter: Ratelimit.slidingWindow(
      AUTH_RATE_LIMIT_REQUESTS,
      AUTH_RATE_LIMIT_WINDOW,
    ),
    redis,
  });
}
