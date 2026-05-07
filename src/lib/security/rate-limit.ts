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
  UPSTASH_REDIS_REST_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
}

function createRedis(env: RateLimitEnv): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
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
