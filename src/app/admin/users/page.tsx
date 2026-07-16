import "server-only";

import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { UserRoleForm } from "@/components/admin/UserRoleForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { requireAdminContext } from "@/lib/auth/admin";
import { MAX_ADMIN_USERS_LIST } from "@/lib/constants";
import { createSupabaseAdminAuthReader } from "@/lib/supabase/admin-reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function UsersPage() {
  const supabase = await createSupabaseServerClient();
  const authResult = await requireAdminContext(
    createSupabaseAdminAuthReader(supabase),
  );

  if (!authResult.ok || authResult.role !== "super_admin") {
    redirect("/admin");
  }

  const db = createSupabaseServiceRoleClient();
  const { data: users, error } = await db
    .from("profiles")
    .select("id, display_name, role, created_at")
    .in("role", ["admin", "super_admin"])
    .order("created_at", { ascending: false })
    .limit(MAX_ADMIN_USERS_LIST);

  if (error) {
    return <ErrorState message="Failed to load users." />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Super admins only. Promote or demote admin accounts."
        title="User Roles"
      />
      {!users?.length ? (
        <p className="text-sm text-f1-muted">No admin users found.</p>
      ) : (
        <ul className="max-w-lg space-y-4">
          {users.map((u) => (
            <li
              className="border border-f1-border bg-f1-dark p-4"
              key={u.id}
            >
              <UserRoleForm
                currentRole={u.role as "racer" | "admin" | "super_admin"}
                displayName={u.display_name}
                userId={u.id}
              />
              <p className="mt-1 font-mono text-xs text-f1-muted">
                {u.id}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
