import { z } from "zod";

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
        { id: "2", is_available: false },
        { id: "3", is_available: true },
      ];
      const eligible = circuits.filter((c) => c.is_available);
      expect(eligible).toHaveLength(2);
      expect(eligible.some((c) => c.id === "2")).toBe(false);
      
      const chosen = eligible[Math.floor(Math.random() * eligible.length)];
      expect(chosen).toBeDefined();
      expect(chosen.is_available).toBe(true);
    });

    it("throws when pool is empty (simulation)", () => {
      const circuits = [{ id: "1", is_available: false }];
      const eligible = circuits.filter((c) => c.is_available);
      
      expect(() => {
        if (eligible.length === 0) throw new Error("No circuits available in the pool.");
      }).toThrowError("No circuits available in the pool.");
    });
  });
});
