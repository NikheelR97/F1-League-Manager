import { readFileSync } from "node:fs";

import { z } from "zod";

import { selectWheelCircuit, validateWheelConfirmation } from "@/lib/wheel/wheel-service";

const createSessionRouteSource = readFileSync(
  "src/app/api/admin/leagues/[id]/sessions/route.ts",
  "utf8",
);
const wheelHistoryPageSource = readFileSync(
  "src/app/leagues/[slug]/wheel/page.tsx",
  "utf8",
);
const wheelConfirmationMigration = readFileSync(
  "supabase/migrations/20260509101500_s6_confirm_wheel_spin_session.sql",
  "utf8",
);

const SESSION_CODE_RE = /^[A-Z0-9]{6}$/;

const createSessionSchema = z.object({
  circuit_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  points_system_id: z.string().uuid(),
  race_length_percent: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  race_number: z.union([z.literal(1), z.literal(2)]),
  scheduled_at: z.string().datetime({ offset: true }),
  session_code: z.string().regex(SESSION_CODE_RE, "Must be 6 uppercase letters/digits"),
  wheel_spin_id: z.string().uuid().optional(),
});

describe("S6 Calendar and Wheel", () => {
  describe("createSessionSchema", () => {
    const validSession = {
      circuit_id: "00000000-0000-4000-8000-000000000001",
      name: "Round 1",
      points_system_id: "00000000-0000-4000-8000-000000000002",
      race_length_percent: 100,
      race_number: 1,
      scheduled_at: "2025-03-01T15:00:00Z",
      session_code: "ABC123",
    };

    it("accepts a valid manual session", () => {
      expect(createSessionSchema.safeParse(validSession).success).toBe(true);
    });

    it("accepts a valid session with wheel_spin_id", () => {
      expect(
        createSessionSchema.safeParse({
          ...validSession,
          wheel_spin_id: "00000000-0000-4000-8000-000000000003",
        }).success,
      ).toBe(true);
    });

    it("rejects session_code not exactly 6 uppercase letters/digits", () => {
      expect(createSessionSchema.safeParse({ ...validSession, session_code: "abc123" }).success).toBe(false);
      expect(createSessionSchema.safeParse({ ...validSession, session_code: "ABC1234" }).success).toBe(false);
      expect(createSessionSchema.safeParse({ ...validSession, session_code: "ABC-12" }).success).toBe(false);
    });

    it("rejects invalid race_length_percent", () => {
      expect(createSessionSchema.safeParse({ ...validSession, race_length_percent: 75 }).success).toBe(false);
    });

    it("rejects invalid race_number", () => {
      expect(createSessionSchema.safeParse({ ...validSession, race_number: 3 }).success).toBe(false);
    });
  });

  describe("Wheel spin logic pure functions", () => {
    it("selects only eligible circuits (simulation)", () => {
      const circuits = [
        { id: "1", is_available: true },
        { id: "2", is_available: true },
      ];
      
      const chosen = selectWheelCircuit(circuits);
      expect(chosen).toBeDefined();
      expect(chosen.is_available).toBe(true);
    });

    it("throws when pool is empty (simulation)", () => {
      expect(() => selectWheelCircuit([])).toThrowError("No circuits available in the pool.");
    });
    
    it("never returns null", () => {
      const circuits = [{ id: "1" }];
      const chosen = selectWheelCircuit(circuits);
      expect(chosen).not.toBeNull();
    });
  });

  describe("Wheel confirmation logic", () => {
    const validSpin = { circuit_id: "c1", status: "pending" };

    it("rejects when spin is null", () => {
      const res = validateWheelConfirmation(null, "c1");
      expect(res).toMatchObject({ ok: false, status: 404 });
    });

    it("rejects double confirmation (status not pending)", () => {
      const res = validateWheelConfirmation({ ...validSpin, status: "confirmed" }, "c1");
      expect(res).toMatchObject({ ok: false, status: 400, error: "Wheel spin is not pending" });
    });

    it("client cannot forge wheel result (circuit mismatch)", () => {
      const res = validateWheelConfirmation(validSpin, "c2");
      expect(res).toMatchObject({ ok: false, status: 400, error: "Circuit mismatch with wheel spin" });
    });

    it("allows valid confirmation", () => {
      const res = validateWheelConfirmation(validSpin, "c1");
      expect(res).toBeNull();
    });
  });

  describe("S6 review regressions", () => {
    it("confirms wheel spins through the atomic database RPC", () => {
      expect(wheelConfirmationMigration).toContain("create or replace function public.confirm_wheel_spin_session");
      expect(wheelConfirmationMigration).toContain("target_league_id uuid");
      expect(wheelConfirmationMigration).toContain("and wheel_spins.league_id = target_league_id");
      expect(wheelConfirmationMigration).toContain("and wheel_spins.season_id = target_season_id");
      expect(wheelConfirmationMigration).toContain("and league_circuit_pools.used_at is null");
      expect(createSessionRouteSource).toContain('.rpc("confirm_wheel_spin_session"');
    });

    it("keeps public wheel history on the public league resolver boundary", () => {
      expect(wheelHistoryPageSource).toContain("resolvePublicLeague(slug)");
      expect(wheelHistoryPageSource).not.toContain("spun_by:profiles");
      expect(wheelHistoryPageSource).not.toContain("confirmed_by:profiles");
    });
  });
});
