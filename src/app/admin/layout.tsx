import "server-only";

import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminContext } from "@/lib/auth/admin";
import { createSupabaseAdminAuthReader } from "@/lib/supabase/admin-reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const authResult = await requireAdminContext(
    createSupabaseAdminAuthReader(supabase),
  );

  if (!authResult.ok) {
    redirect(authResult.status === 401 ? "/login" : "/");
  }

  return <AdminShell role={authResult.role}>{children}</AdminShell>;
}
