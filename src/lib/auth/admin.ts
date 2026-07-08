import { z } from "zod";

import { isAdminRole, profileRoleSchema, type ProfileRole } from "@/lib/auth/roles";

const userIdSchema = z.string().uuid();

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

type AuthUserResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; error: string };

type RoleResult =
  | { ok: true; role: ProfileRole }
  | { ok: false; error: string };

export interface AdminAuthReader {
  getUser: () => Promise<AuthUserResult>;
  getProfileRole: (userId: string) => Promise<RoleResult>;
}

export type AdminAuthResult =
  | { ok: true; user: AuthenticatedUser; role: ProfileRole }
  | { ok: false; status: 401 | 403; error: "Unauthorized" | "Forbidden" };

export async function requireAdminContext(
  reader: AdminAuthReader,
): Promise<AdminAuthResult> {
  try {
    const userResult = await reader.getUser();
    if (!userResult.ok) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }

    const user = userResult.user;
    userIdSchema.parse(user.id);

    const roleResult = await reader.getProfileRole(user.id);
    if (!roleResult.ok) {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    const role = profileRoleSchema.parse(roleResult.role);
    if (!isAdminRole(role)) {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    return { ok: true, user, role };
  } catch {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
}
