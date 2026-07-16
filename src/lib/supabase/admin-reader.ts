import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminAuthReader } from "@/lib/auth/admin";
import { profileRoleSchema } from "@/lib/auth/roles";

export function createSupabaseAdminAuthReader(
  supabase: SupabaseClient,
): AdminAuthReader {
  return {
    async getUser() {
      try {
        const authResponse = await supabase.auth.getUser();
        const authData = authResponse.data;
        const authUser = authData.user;

        if (authResponse.error || !authUser) {
          return { ok: false, error: "Unauthorized" };
        }

        return {
          ok: true,
          user: {
            id: authUser.id,
            email: authUser.email ?? null,
          },
        };
      } catch {
        return { ok: false, error: "Unauthorized" };
      }
    },
    async getProfileRole(userId) {
      try {
        const profileResponse = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        const profileData = profileResponse.data;
        const roleResult = profileRoleSchema.safeParse(profileData?.role);

        if (profileResponse.error || !roleResult.success) {
          return { ok: false, error: "Forbidden" };
        }

        return { ok: true, role: roleResult.data };
      } catch {
        return { ok: false, error: "Forbidden" };
      }
    },
  };
}
