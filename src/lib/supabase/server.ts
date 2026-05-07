import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { MAX_AUTH_COOKIES } from "@/lib/constants";
import { readPublicEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const env = readPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const boundedCookies = cookiesToSet.slice(0, MAX_AUTH_COOKIES);
            for (const cookieToSet of boundedCookies) {
              const { name, value, options } = cookieToSet;
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot always set cookies; middleware will refresh sessions.
          }
        },
      },
    },
  );
}
