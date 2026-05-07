import { requireAdminContext, type AdminAuthReader } from "@/lib/auth/admin";

const adminUser = {
  email: "admin@example.com",
  id: "00000000-0000-4000-8000-000000000001",
};

function createReader(role: "admin" | "racer" | "super_admin"): AdminAuthReader {
  return {
    getProfileRole: async () => ({ ok: true, role }),
    getUser: async () => ({ ok: true, user: adminUser }),
  };
}

describe("requireAdminContext", () => {
  it("allows admin and super admin roles", async () => {
    await expect(requireAdminContext(createReader("admin"))).resolves.toMatchObject({
      ok: true,
      role: "admin",
    });
    await expect(
      requireAdminContext(createReader("super_admin")),
    ).resolves.toMatchObject({ ok: true, role: "super_admin" });
  });

  it("rejects missing users and racer roles", async () => {
    const anonymousReader: AdminAuthReader = {
      getProfileRole: async () => ({ ok: false, error: "Forbidden" }),
      getUser: async () => ({ ok: false, error: "Unauthorized" }),
    };

    await expect(requireAdminContext(anonymousReader)).resolves.toMatchObject({
      error: "Unauthorized",
      status: 401,
    });
    await expect(requireAdminContext(createReader("racer"))).resolves.toMatchObject({
      error: "Forbidden",
      status: 403,
    });
  });

  it("rejects missing profile roles and invalid user ids", async () => {
    const noProfileReader: AdminAuthReader = {
      getProfileRole: async () => ({ ok: false, error: "Forbidden" }),
      getUser: async () => ({ ok: true, user: adminUser }),
    };
    const invalidUserReader: AdminAuthReader = {
      getProfileRole: async () => ({ ok: true, role: "admin" }),
      getUser: async () => ({
        ok: true,
        user: { email: null, id: "not-a-uuid" },
      }),
    };

    await expect(requireAdminContext(noProfileReader)).resolves.toMatchObject({
      error: "Forbidden",
      status: 403,
    });
    await expect(requireAdminContext(invalidUserReader)).resolves.toMatchObject({
      error: "Unauthorized",
      status: 401,
    });
  });
});
