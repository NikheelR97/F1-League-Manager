"use client";

import { useEffect, useState } from "react";

// Server tokens stay valid for 1 hour (see CSRF_TOKEN_VALIDITY_MS in
// src/lib/security/csrf.ts). Refresh a little before that so a cached token
// never goes stale mid-session.
const TOKEN_TTL_MS = 55 * 60 * 1000;

let tokenPromise: Promise<string> | null = null;
let tokenFetchedAt = 0;

function getCsrfToken(): Promise<string> {
  if (!tokenPromise || Date.now() - tokenFetchedAt > TOKEN_TTL_MS) {
    tokenFetchedAt = Date.now();
    tokenPromise = fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { token: string }) => d.token)
      .catch((err) => {
        tokenPromise = null;
        throw err;
      });
  }
  return tokenPromise;
}

export function useCsrfToken(): string {
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCsrfToken()
      .then((t) => {
        if (!cancelled) setToken(t);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return token;
}
