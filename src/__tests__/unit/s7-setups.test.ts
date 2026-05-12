import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildDuplicateName,
  createSetupSchema,
  updateSetupSchema,
  verifySetupOwnership,
} from "@/lib/racer/setup-service";

// Source files for security regression checks
const racerGuardSource = readFileSync("src/lib/racer/api-guard.ts", "utf8");
const setupsRouteSource = readFileSync("src/app/api/racer/setups/route.ts", "utf8");
const setupIdRouteSource = readFileSync("src/app/api/racer/setups/[id]/route.ts", "utf8");
const duplicateRouteSource = readFileSync(
  "src/app/api/racer/setups/[id]/duplicate/route.ts",
  "utf8",
);
const garagePageSource = readFileSync("src/app/garage/page.tsx", "utf8");
const editPageSource = readFileSync("src/app/garage/[id]/edit/page.tsx", "utf8");

// ---------------------------------------------------------------------------
// 1. createSetupSchema validation
// ---------------------------------------------------------------------------

const validSetup = {
  driver_id: "00000000-0000-4000-8000-000000000001",
  circuit_id: "00000000-0000-4000-8000-000000000002",
  name: "Monaco Quali",
  setup_data: { front_wing: 8, rear_wing: 3 },
};

describe("createSetupSchema", () => {
  it("accepts a minimal valid setup", () => {
    expect(createSetupSchema.safeParse(validSetup).success).toBe(true);
  });

  it("defaults is_public to false", () => {
    const result = createSetupSchema.safeParse(validSetup);
    expect(result.success && result.data.is_public).toBe(false);
  });

  it("accepts setup_data as any JSON object", () => {
    expect(
      createSetupSchema.safeParse({ ...validSetup, setup_data: { nested: { value: 1 } } }).success,
    ).toBe(true);
  });

  it("rejects array as setup_data (must be object)", () => {
    expect(createSetupSchema.safeParse({ ...validSetup, setup_data: [1, 2, 3] }).success).toBe(
      false,
    );
  });

  it("rejects primitive as setup_data", () => {
    expect(createSetupSchema.safeParse({ ...validSetup, setup_data: 42 }).success).toBe(false);
    expect(createSetupSchema.safeParse({ ...validSetup, setup_data: "string" }).success).toBe(
      false,
    );
    expect(createSetupSchema.safeParse({ ...validSetup, setup_data: null }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(createSetupSchema.safeParse({ ...validSetup, name: "" }).success).toBe(false);
  });

  it("rejects name over 100 characters", () => {
    expect(
      createSetupSchema.safeParse({ ...validSetup, name: "a".repeat(101) }).success,
    ).toBe(false);
    expect(
      createSetupSchema.safeParse({ ...validSetup, name: "a".repeat(100) }).success,
    ).toBe(true);
  });

  it("rejects game_version over 40 characters", () => {
    expect(
      createSetupSchema.safeParse({ ...validSetup, game_version: "v".repeat(41) }).success,
    ).toBe(false);
    expect(
      createSetupSchema.safeParse({ ...validSetup, game_version: "v".repeat(40) }).success,
    ).toBe(true);
  });

  it("rejects weather over 40 characters", () => {
    expect(
      createSetupSchema.safeParse({ ...validSetup, weather: "w".repeat(41) }).success,
    ).toBe(false);
  });

  it("rejects invalid driver_id UUID", () => {
    expect(
      createSetupSchema.safeParse({ ...validSetup, driver_id: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("rejects invalid circuit_id UUID", () => {
    expect(
      createSetupSchema.safeParse({ ...validSetup, circuit_id: "bad" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. updateSetupSchema validation
// ---------------------------------------------------------------------------

describe("updateSetupSchema", () => {
  it("accepts empty update (all fields optional)", () => {
    expect(updateSetupSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update", () => {
    expect(updateSetupSchema.safeParse({ name: "New Name", is_public: true }).success).toBe(true);
  });

  it("rejects array as setup_data in update", () => {
    expect(updateSetupSchema.safeParse({ setup_data: [1, 2] }).success).toBe(false);
  });

  it("allows null for nullable optional fields (game_version, weather, league_id)", () => {
    expect(
      updateSetupSchema.safeParse({ game_version: null, weather: null, league_id: null }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. verifySetupOwnership — owner-only access
// ---------------------------------------------------------------------------

const driverRows = [
  { id: "d1", profile_id: "u1" },
  { id: "d2", profile_id: "u2" },
];

describe("verifySetupOwnership", () => {
  it("returns true when setup driver is in the user's driver list", () => {
    expect(verifySetupOwnership({ driver_id: "d1" }, driverRows)).toBe(true);
  });

  it("returns false when setup driver belongs to a different user", () => {
    expect(verifySetupOwnership({ driver_id: "d2" }, [{ id: "d1", profile_id: "u1" }])).toBe(
      false,
    );
  });

  it("returns false when setup is null", () => {
    expect(verifySetupOwnership(null, driverRows)).toBe(false);
  });

  it("returns false when driver list is empty", () => {
    expect(verifySetupOwnership({ driver_id: "d1" }, [])).toBe(false);
  });

  it("does not grant access to an unlinked driver", () => {
    expect(verifySetupOwnership({ driver_id: "d9" }, driverRows)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. buildDuplicateName
// ---------------------------------------------------------------------------

describe("buildDuplicateName", () => {
  it("appends ' (copy)' to a normal name", () => {
    expect(buildDuplicateName("Monaco Quali")).toBe("Monaco Quali (copy)");
  });

  it("truncates to stay within 100 character limit", () => {
    const longName = "a".repeat(100);
    const result = buildDuplicateName(longName);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/ \(copy\)$/);
  });
});

// ---------------------------------------------------------------------------
// 5. Racer guard security regressions
// ---------------------------------------------------------------------------

describe("Racer guard security", () => {
  it("imports server-only marker", () => {
    expect(racerGuardSource).toContain('import "server-only"');
  });

  it("checks origin for mutating methods", () => {
    expect(racerGuardSource).toContain("Origin check for mutating methods");
    expect(racerGuardSource).toContain("requestOrigin !== expectedOrigin");
  });

  it("validates CSRF token for writes", () => {
    expect(racerGuardSource).toContain("verifyCsrfToken");
    expect(racerGuardSource).toContain("CSRF_SECRET");
  });

  it("checks session before allowing access", () => {
    expect(racerGuardSource).toContain("supabase.auth.getUser()");
    expect(racerGuardSource).toContain("Unauthorized");
  });

  it("enforces payload size limit", () => {
    expect(racerGuardSource).toContain("MAX_REQUEST_BODY_BYTES");
    expect(racerGuardSource).toContain("Payload too large");
  });
});

// ---------------------------------------------------------------------------
// 6. API route security regressions
// ---------------------------------------------------------------------------

describe("Setups list route (GET)", () => {
  it("scopes setups to the current user's drivers only", () => {
    expect(setupsRouteSource).toContain("profile_id");
    expect(setupsRouteSource).toContain("userId");
    expect(setupsRouteSource).toContain(".in(\"driver_id\", driverIds)");
  });

  it("does NOT return setup_data in the list response", () => {
    // setup_data must not appear in the GET select string
    const selectLine = setupsRouteSource.match(/\.select\(\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "";
    expect(selectLine).not.toContain("setup_data");
  });

  it("applies a hard list limit", () => {
    expect(setupsRouteSource).toContain("MAX_SETUPS_LIST");
  });
});

describe("Setup create route (POST)", () => {
  it("verifies driver_id ownership before insert", () => {
    expect(setupsRouteSource).toContain("profile_id");
    expect(setupsRouteSource).toContain("not owned by you");
  });

  it("validates body with Zod", () => {
    expect(setupsRouteSource).toContain("createSetupSchema.parse");
  });
});

describe("Setup update/delete route (PATCH/DELETE)", () => {
  it("resolves ownership before any mutation", () => {
    expect(setupIdRouteSource).toContain("resolveOwnedSetup");
    expect(setupIdRouteSource).toContain("profile_id");
    expect(setupIdRouteSource).toContain("userId");
  });

  it("returns 404 (not 403) to avoid information leakage on non-owned setups", () => {
    // The route returns 404 for not-found/not-owned setups (avoids leaking existence)
    expect(setupIdRouteSource).toContain("Setup not found");
    // Ownership check resolves null, and null triggers 404 in the handler
    expect(setupIdRouteSource).toContain("profile_id !== userId");
    expect(setupIdRouteSource).toContain("return null");
    expect(setupIdRouteSource).toContain("{ status: 404 }");
  });
});

describe("Duplicate route (POST)", () => {
  it("verifies ownership before duplicate", () => {
    expect(duplicateRouteSource).toContain("profile_id");
    expect(duplicateRouteSource).toContain("userId");
  });

  it("forces is_public = false on duplicate (copies start private)", () => {
    expect(duplicateRouteSource).toContain("is_public: false");
  });

  it("uses buildDuplicateName for the copy name", () => {
    expect(duplicateRouteSource).toContain("buildDuplicateName");
  });
});

// ---------------------------------------------------------------------------
// 7. Page-level security regressions
// ---------------------------------------------------------------------------

describe("Garage page server-side auth", () => {
  it("redirects to /login when not authenticated", () => {
    expect(garagePageSource).toContain('redirect("/login")');
  });

  it("does not expose setup_data in the list query", () => {
    // setup_data must not appear in the vehicle_setups select for the list
    const selectMatch = garagePageSource.indexOf('"vehicle_setups"');
    const selectBlock = garagePageSource.slice(selectMatch, selectMatch + 500);
    expect(selectBlock).not.toContain("setup_data");
  });
});

describe("Edit page server-side auth", () => {
  it("redirects to /login when not authenticated", () => {
    expect(editPageSource).toContain('redirect("/login")');
  });

  it("verifies ownership before rendering the form", () => {
    expect(editPageSource).toContain("profile_id");
    expect(editPageSource).toContain("user.id");
    expect(editPageSource).toContain("notFound()");
  });
});

// ---------------------------------------------------------------------------
// 8. Zod record schema exhaustive type check
// ---------------------------------------------------------------------------

describe("z.record(z.string(), z.unknown()) — bounded JSON object constraint", () => {
  const recordSchema = z.record(z.string(), z.unknown());

  it("accepts empty object", () => {
    expect(recordSchema.safeParse({}).success).toBe(true);
  });

  it("accepts nested object", () => {
    expect(recordSchema.safeParse({ a: { b: [1, 2, 3] } }).success).toBe(true);
  });

  it("rejects array at root", () => {
    expect(recordSchema.safeParse([]).success).toBe(false);
  });

  it("rejects number at root", () => {
    expect(recordSchema.safeParse(42).success).toBe(false);
  });

  it("rejects null at root", () => {
    expect(recordSchema.safeParse(null).success).toBe(false);
  });
});
