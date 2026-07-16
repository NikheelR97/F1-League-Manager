/**
 * Cache tag factories for Next.js `revalidateTag` and `unstable_cache`.
 *
 * Usage in mutation routes:
 *   import { revalidateTag } from "next/cache";
 *   import { cacheTag } from "@/lib/cache/tags";
 *   revalidateTag(cacheTag.standings(leagueId));
 *
 * Usage in pages:
 *   import { unstable_cache } from "next/cache";
 *   import { cacheTag } from "@/lib/cache/tags";
 *   const fetch = unstable_cache(fn, [key], { tags: [cacheTag.standings(leagueId)] });
 */
export const cacheTag = {
  /** Driver + constructor standings for a league */
  standings: (leagueId: string) => `standings:${leagueId}`,
  /** Results index (list of sessions) for a league */
  results: (leagueId: string) => `results:${leagueId}`,
  /** Full result page for a single session */
  session: (sessionId: string) => `session:${sessionId}`,
  /** Penalties page for a league */
  penalties: (leagueId: string) => `penalties:${leagueId}`,
  /** Wheel history page for a league */
  wheel: (leagueId: string) => `wheel:${leagueId}`,
  /** League hub page (assets, team roster, driver list) */
  league: (leagueId: string) => `league:${leagueId}`,
} as const;
