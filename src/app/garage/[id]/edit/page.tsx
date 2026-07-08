import "server-only";

import { notFound, redirect } from "next/navigation";

import { SetupForm } from "@/components/garage/SetupForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function EditSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: setupId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createSupabaseServiceRoleClient();

  // Fetch the setup; verify it belongs to this user via the driver link
  const { data: setup } = await db
    .from("vehicle_setups")
    .select(
      "id, driver_id, circuit_id, name, game_version, weather, is_public, league_id, setup_data, drivers!inner(profile_id)",
    )
    .eq("id", setupId)
    .single();

  if (!setup) notFound();

  const driver = setup.drivers as unknown as { profile_id: string | null };
  if (driver.profile_id !== user.id) notFound();

  const [circuitsResult, leaguesResult] = await Promise.all([
    db.from("circuits").select("id, name, country").order("country"),
    db.from("leagues").select("id, name").neq("status", "draft").order("name"),
  ]);

  const circuits = circuitsResult.data ?? [];
  const leagues = leaguesResult.data ?? [];

  const defaultValues = {
    driver_id: setup.driver_id,
    circuit_id: setup.circuit_id,
    name: setup.name,
    game_version: setup.game_version ?? "",
    weather: setup.weather ?? "",
    is_public: setup.is_public,
    league_id: setup.league_id ?? "",
    setup_data_raw: JSON.stringify(setup.setup_data, null, 2),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 border-b border-f1-border pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-tight text-f1-white">
          Edit Setup
        </h1>
        <p className="mt-1 text-sm text-f1-muted">{setup.name}</p>
      </header>
      <SetupForm
        circuits={circuits}
        defaultValues={defaultValues}
        drivers={[]}
        leagues={leagues}
        setupId={setupId}
      />
    </div>
  );
}
