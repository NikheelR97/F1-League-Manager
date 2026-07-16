"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Handles password-recovery links that arrive via the URL hash (implicit flow).
 *
 * The in-app flow (/forgot-password) uses PKCE and lands on /auth/callback.
 * But a recovery link generated from the Supabase dashboard ("Send password
 * recovery") uses the implicit flow and redirects to the project's Site URL
 * (the site root) with `#access_token=...&refresh_token=...&type=recovery` in
 * the hash. @supabase/ssr's browser client only auto-handles the PKCE `?code=`
 * flow, so nothing consumes those hash tokens and the user is stranded on the
 * homepage.
 *
 * Mounted app-wide (root layout). It no-ops unless a recovery hash is present;
 * when it is, it establishes the session from the hash tokens (setSession),
 * scrubs the tokens from the URL, and sends the user to /reset-password.
 */
export function AuthRecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) return;
    if (pathname === "/reset-password") return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    const supabase = createSupabaseBrowserClient();
    void supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        // Always scrub the sensitive tokens from the URL bar.
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
        if (!error) router.replace("/reset-password");
      });
  }, [pathname, router]);

  return null;
}
