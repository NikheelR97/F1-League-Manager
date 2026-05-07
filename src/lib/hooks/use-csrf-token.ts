"use client";

import { useEffect, useState } from "react";

export function useCsrfToken(): string {
  const [token, setToken] = useState("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d: { token: string }) => setToken(d.token))
      .catch(() => {});
  }, []);

  return token;
}
