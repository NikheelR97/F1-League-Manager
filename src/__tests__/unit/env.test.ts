import { readPublicEnv, readServerEnv } from "@/lib/env";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-role-key",
  CSRF_SECRET: "a".repeat(64),
  SUPABASE_STORAGE_ASSET_BUCKET: "league-assets",
};

describe("environment validation", () => {
  it("parses required public values", () => {
    expect(readPublicEnv(validEnv).NEXT_PUBLIC_SITE_URL).toBe(
      "http://localhost:3000",
    );
  });

  it("parses required server-only values", () => {
    expect(readServerEnv(validEnv).SUPABASE_SERVICE_ROLE_KEY).toBe(
      "local-service-role-key",
    );
  });

  it("rejects invalid CSRF secrets", () => {
    expect(() =>
      readServerEnv({ ...validEnv, CSRF_SECRET: "too-short" }),
    ).toThrow();
  });
});
