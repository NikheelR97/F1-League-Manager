import { type NextRequest } from "next/server";

import { withAdminGuard } from "@/lib/admin/api-guard";
import { MAX_ADMIN_USERS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(req: NextRequest) {
  return withAdminGuard(req, async (_req, auth) => {
    if (auth.role !== "super_admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = createSupabaseServiceRoleClient();
    const { data, error } = await db
      .from("profiles")
      .select("id, display_name, role, created_at")
      .in("role", ["admin", "super_admin"])
      .order("created_at", { ascending: false })
      .limit(MAX_ADMIN_USERS_LIST);

    if (error) {
      return Response.json({ error: "Failed to load users" }, { status: 500 });
    }

    return Response.json({ users: data });
  }, { skipCsrf: true });
}
