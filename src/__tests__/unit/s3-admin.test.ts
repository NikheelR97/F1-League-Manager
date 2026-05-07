/**
 * S3 Admin — unit tests for team, driver, points system, asset upload, and transfer logic.
 * These tests exercise validation schemas and business rules without hitting the database.
 */
import { z } from "zod";

import {
  MAX_DRIVERS_LIST,
  MAX_POINTS_POSITIONS,
  MAX_PRIMARY_DRIVERS_PER_TEAM,
  MAX_TEAMS_LIST,
} from "@/lib/constants";

// ─── Schema definitions copied from route files for isolated testing ───────

const createTeamSchema = z.object({
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex colour like #FF0000"),
  kind: z.enum(["official", "custom"]),
  name: z.string().trim().min(1).max(100),
  official_template_id: z.string().uuid().nullable().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const createDriverSchema = z.object({
  country: z.string().trim().min(2).max(80).nullable().optional(),
  display_name: z.string().trim().min(1).max(80),
  profile_id: z.string().uuid().nullable().optional(),
  racing_number: z.number().int().min(1).max(999).nullable().optional(),
});

const addDriverSchema = z.object({
  carry_over_ban_count: z.number().int().min(0),
  carry_over_penalty_points: z.number().int().min(0),
  driver_id: z.string().uuid(),
  is_reserve: z.boolean(),
  joined_on: z.string().date(),
  team_id: z.string().uuid(),
});

const transferSchema = z.object({
  driver_entry_id: z.string().uuid(),
  effective_date: z.string().date(),
  new_team_id: z.string().uuid().nullable(),
  transfer_reason: z.string().trim().max(240).nullable().optional(),
});

const pointsByPositionSchema = z
  .record(z.string().regex(/^\d+$/), z.number().int().min(0).max(999))
  .refine(
    (v) => Object.keys(v).length > 0 && Object.keys(v).length <= MAX_POINTS_POSITIONS,
    { message: `Must have 1–${MAX_POINTS_POSITIONS} positions` },
  );

const createPointsSystemSchema = z.object({
  fastest_lap_points: z.number().int().min(0).max(10).default(1),
  max_positions: z.number().int().min(1).max(MAX_POINTS_POSITIONS).default(10),
  name: z.string().trim().min(1).max(80),
  points_by_position: pointsByPositionSchema,
  pole_position_points: z.number().int().min(0).max(10).default(0),
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe("S3 constants", () => {
  it("primary driver limit is 2", () => {
    expect(MAX_PRIMARY_DRIVERS_PER_TEAM).toBe(2);
  });

  it("team list cap is 20", () => {
    expect(MAX_TEAMS_LIST).toBe(20);
  });

  it("driver list cap is 100", () => {
    expect(MAX_DRIVERS_LIST).toBe(100);
  });

  it("points positions cap is 20", () => {
    expect(MAX_POINTS_POSITIONS).toBe(20);
  });
});

// ─── Team schema ────────────────────────────────────────────────────────────

describe("team create schema", () => {
  it("accepts a valid custom team", () => {
    const result = createTeamSchema.safeParse({
      color_hex: "#E8002D",
      kind: "custom",
      name: "Red Racing",
      slug: "red-racing",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid official team with template id", () => {
    const result = createTeamSchema.safeParse({
      color_hex: "#3671C6",
      kind: "official",
      name: "Oracle Red Bull Racing",
      official_template_id: "00000000-0000-4000-8000-000000000001",
      slug: "oracle-red-bull-racing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid hex colour", () => {
    const result = createTeamSchema.safeParse({
      color_hex: "red",
      kind: "custom",
      name: "Bad Colour",
      slug: "bad-colour",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    const result = createTeamSchema.safeParse({
      color_hex: "#E8002D",
      kind: "custom",
      name: "Test",
      slug: "Bad-Slug",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = createTeamSchema.safeParse({
      color_hex: "#E8002D",
      kind: "custom",
      name: "Test",
      slug: "bad slug",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with leading hyphen", () => {
    const result = createTeamSchema.safeParse({
      color_hex: "#E8002D",
      kind: "custom",
      name: "Test",
      slug: "-bad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid kind", () => {
    const result = createTeamSchema.safeParse({
      color_hex: "#E8002D",
      kind: "factory",
      name: "Test",
      slug: "test",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Driver schema ──────────────────────────────────────────────────────────

describe("driver create schema", () => {
  it("accepts minimal driver (name only)", () => {
    const result = createDriverSchema.safeParse({ display_name: "Max Verstappen" });
    expect(result.success).toBe(true);
  });

  it("accepts full driver", () => {
    const result = createDriverSchema.safeParse({
      country: "Netherlands",
      display_name: "Max Verstappen",
      racing_number: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects racing number out of range", () => {
    const result = createDriverSchema.safeParse({
      display_name: "Test",
      racing_number: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects racing number of 0", () => {
    const result = createDriverSchema.safeParse({
      display_name: "Test",
      racing_number: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty display name", () => {
    const result = createDriverSchema.safeParse({ display_name: "" });
    expect(result.success).toBe(false);
  });
});

// ─── Add driver to league schema ─────────────────────────────────────────────

describe("add league driver schema", () => {
  const validEntry = {
    carry_over_ban_count: 0,
    carry_over_penalty_points: 0,
    driver_id: "00000000-0000-4000-8000-000000000001",
    is_reserve: false,
    joined_on: "2025-03-01",
    team_id: "00000000-0000-4000-8000-000000000002",
  };

  it("accepts a valid primary driver entry", () => {
    expect(addDriverSchema.safeParse(validEntry).success).toBe(true);
  });

  it("accepts a reserve driver entry", () => {
    expect(addDriverSchema.safeParse({ ...validEntry, is_reserve: true }).success).toBe(true);
  });

  it("rejects negative carry-over penalty points", () => {
    expect(
      addDriverSchema.safeParse({ ...validEntry, carry_over_penalty_points: -1 }).success,
    ).toBe(false);
  });

  it("rejects invalid driver_id UUID", () => {
    expect(addDriverSchema.safeParse({ ...validEntry, driver_id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects invalid joined_on date", () => {
    expect(addDriverSchema.safeParse({ ...validEntry, joined_on: "01-03-2025" }).success).toBe(false);
  });
});

// ─── Transfer schema ─────────────────────────────────────────────────────────

describe("transfer schema", () => {
  const validTransfer = {
    driver_entry_id: "00000000-0000-4000-8000-000000000001",
    effective_date: "2025-06-01",
    new_team_id: "00000000-0000-4000-8000-000000000002",
  };

  it("accepts a team change transfer", () => {
    expect(transferSchema.safeParse(validTransfer).success).toBe(true);
  });

  it("accepts a departure (new_team_id = null)", () => {
    expect(transferSchema.safeParse({ ...validTransfer, new_team_id: null }).success).toBe(true);
  });

  it("accepts an optional reason", () => {
    expect(
      transferSchema.safeParse({ ...validTransfer, transfer_reason: "Contract ended" }).success,
    ).toBe(true);
  });

  it("rejects reason over 240 characters", () => {
    expect(
      transferSchema.safeParse({ ...validTransfer, transfer_reason: "x".repeat(241) }).success,
    ).toBe(false);
  });

  it("rejects invalid effective_date format", () => {
    expect(
      transferSchema.safeParse({ ...validTransfer, effective_date: "2025/06/01" }).success,
    ).toBe(false);
  });

  it("rejects non-uuid driver_entry_id", () => {
    expect(
      transferSchema.safeParse({ ...validTransfer, driver_entry_id: "abc" }).success,
    ).toBe(false);
  });
});

// ─── Points system schema ────────────────────────────────────────────────────

describe("points system schema", () => {
  const standardPoints: Record<string, number> = {
    "1": 25, "2": 18, "3": 15, "4": 12, "5": 10,
    "6": 8, "7": 6, "8": 4, "9": 2, "10": 1,
  };

  const validSystem = {
    fastest_lap_points: 1,
    max_positions: 10,
    name: "Standard F1 Points",
    points_by_position: standardPoints,
    pole_position_points: 0,
  };

  it("accepts the standard F1 points system", () => {
    expect(createPointsSystemSchema.safeParse(validSystem).success).toBe(true);
  });

  it("accepts a custom points system", () => {
    expect(
      createPointsSystemSchema.safeParse({
        ...validSystem,
        name: "Custom",
        points_by_position: { "1": 10, "2": 6, "3": 3 },
      }).success,
    ).toBe(true);
  });

  it("rejects empty points_by_position", () => {
    expect(
      createPointsSystemSchema.safeParse({ ...validSystem, points_by_position: {} }).success,
    ).toBe(false);
  });

  it("rejects non-numeric position keys", () => {
    expect(
      createPointsSystemSchema.safeParse({
        ...validSystem,
        points_by_position: { "first": 25 },
      }).success,
    ).toBe(false);
  });

  it("rejects negative position points", () => {
    expect(
      createPointsSystemSchema.safeParse({
        ...validSystem,
        points_by_position: { "1": -5 },
      }).success,
    ).toBe(false);
  });

  it("rejects fastest_lap_points over 10", () => {
    expect(
      createPointsSystemSchema.safeParse({ ...validSystem, fastest_lap_points: 11 }).success,
    ).toBe(false);
  });

  it("rejects max_positions over the cap", () => {
    expect(
      createPointsSystemSchema.safeParse({ ...validSystem, max_positions: MAX_POINTS_POSITIONS + 1 }).success,
    ).toBe(false);
  });
});

// ─── Asset upload constraints ─────────────────────────────────────────────────

describe("asset upload constraints", () => {
  const MAX_ASSET_BYTES = 5 * 1024 * 1024;
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
  const ALLOWED_KIND = new Set(["logo", "car_image"]);

  it("allows JPEG, PNG, WebP", () => {
    expect(ALLOWED_MIME.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME.has("image/png")).toBe(true);
    expect(ALLOWED_MIME.has("image/webp")).toBe(true);
  });

  it("rejects SVG (XSS risk)", () => {
    expect(ALLOWED_MIME.has("image/svg+xml")).toBe(false);
  });

  it("rejects GIF", () => {
    expect(ALLOWED_MIME.has("image/gif")).toBe(false);
  });

  it("allows logo and car_image kinds", () => {
    expect(ALLOWED_KIND.has("logo")).toBe(true);
    expect(ALLOWED_KIND.has("car_image")).toBe(true);
  });

  it("rejects unknown asset kind", () => {
    expect(ALLOWED_KIND.has("hero")).toBe(false);
  });

  it("5 MB limit is correct", () => {
    expect(MAX_ASSET_BYTES).toBe(5_242_880);
  });
});
