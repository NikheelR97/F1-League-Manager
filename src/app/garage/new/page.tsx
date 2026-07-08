import "server-only";

import { redirect } from "next/navigation";

import { SetupForm } from "@/components/garage/SetupForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function NewSetupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createSupabaseServiceRoleClient();

  const [circuitsResult, driversResult, leaguesResult] = await Promise.all([
    db.from("circuits").select("id, name, country").order("country"),
    db
      .from("drivers")
      .select("id, display_name")
      .eq("profile_id", user.id),
    db
      .from("leagues")
      .select("id, name")
      .neq("status", "draft")
      .order("name"),
  ]);

  const circuits = circuitsResult.data ?? [];
  const drivers = driversResult.data ?? [];
  const leagues = leaguesResult.data ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 border-b border-f1-border pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-tight text-f1-white">
          New Setup
        </h1>
        <p className="mt-1 text-sm text-f1-muted">
          Create a private vehicle configuration.
        </p>
      </header>
      <SetupForm circuits={circuits} drivers={drivers} leagues={leagues} />
    </div>
  );
}
