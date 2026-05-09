import "server-only";

import { redirect } from "next/navigation";

import { GarageShell } from "@/components/garage/GarageShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function GarageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const db = createSupabaseServiceRoleClient();
  const { data: profile } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? "Racer";

  return <GarageShell displayName={displayName}>{children}</GarageShell>;
}
