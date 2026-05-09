import "server-only";

import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupCard } from "@/components/garage/SetupCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MAX_SETUPS_LIST } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

interface SearchParams {
  circuit_id?: string;
  game_version?: string;
  weather?: string;
  league_id?: string;
}

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createSupabaseServiceRoleClient();

  const { data: drivers, error: driverError } = await db
    .from("drivers")
    .select("id, display_name")
    .eq("profile_id", user.id);

  if (driverError) return <ErrorState message="Failed to load garage" />;

  const driverIds = (drivers ?? []).map((d) => d.id);

  // Fetch circuits and leagues for filter bar
  const [circuitsResult, leaguesResult] = await Promise.all([
    db.from("circuits").select("id, name, country").order("country"),
    db.from("leagues").select("id, name").neq("status", "draft").order("name"),
  ]);

  const circuits = circuitsResult.data ?? [];
  const leagues = leaguesResult.data ?? [];

  if (driverIds.length === 0) {
    return (
      <div className="space-y-6">
        <GarageHeader />
        <EmptyState title="No Driver Profile" message="No driver profile linked to your account. Ask your league admin to set you up." />
      </div>
    );
  }

  let query = db
    .from("vehicle_setups")
    .select(
      "id, driver_id, circuit_id, name, game_version, weather, is_public, league_id, updated_at, circuits(name, country)",
    )
    .in("driver_id", driverIds)
    .order("updated_at", { ascending: false })
    .limit(MAX_SETUPS_LIST);

  if (filters.circuit_id) query = query.eq("circuit_id", filters.circuit_id);
  if (filters.game_version) query = query.eq("game_version", filters.game_version);
  if (filters.weather) query = query.eq("weather", filters.weather);
  if (filters.league_id) query = query.eq("league_id", filters.league_id);

  const { data: setups, error: setupError } = await query;
  if (setupError) return <ErrorState message="Failed to load setups" />;

  return (
    <div className="space-y-6">
      <GarageHeader />

      {/* Filter bar */}
      <form className="flex flex-wrap gap-3" method="GET">
        <select
          className="border border-f1-border bg-f1-black px-3 py-1.5 text-xs text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
          defaultValue={filters.circuit_id ?? ""}
          name="circuit_id"
        >
          <option value="">All circuits</option>
          {circuits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="border border-f1-border bg-f1-black px-3 py-1.5 text-xs text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
          defaultValue={filters.weather ?? ""}
          name="weather"
        >
          <option value="">All weather</option>
          <option value="Dry">Dry</option>
          <option value="Wet">Wet</option>
          <option value="Mixed">Mixed</option>
        </select>

        {leagues.length > 0 && (
          <select
            className="border border-f1-border bg-f1-black px-3 py-1.5 text-xs text-f1-white focus:outline-none focus:ring-1 focus:ring-f1-red"
            defaultValue={filters.league_id ?? ""}
            name="league_id"
          >
            <option value="">All leagues</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}

        <button
          className="border border-f1-border px-3 py-1.5 text-xs font-bold uppercase text-f1-muted transition-colors hover:text-f1-white"
          type="submit"
        >
          Filter
        </button>
        {(filters.circuit_id || filters.weather || filters.league_id) && (
          <Link
            className="border border-f1-border px-3 py-1.5 text-xs font-bold uppercase text-f1-muted transition-colors hover:text-f1-white"
            href="/garage"
          >
            Clear
          </Link>
        )}
      </form>

      {!setups || setups.length === 0 ? (
        <EmptyState title="No Setups Yet" message="No setups yet. Create your first setup to get started." />
      ) : (
        <GarageGrid setups={setups} />
      )}
    </div>
  );
}

function GarageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-tight text-f1-white">
          My Setups
        </h1>
        <p className="mt-1 text-sm text-f1-muted">Your private vehicle configuration library.</p>
      </div>
      <Link
        className="flex items-center gap-2 border border-f1-red bg-f1-red px-4 py-2 text-xs font-bold uppercase text-f1-white transition-colors hover:bg-transparent"
        href="/garage/new"
      >
        <Plus size={14} />
        New Setup
      </Link>
    </div>
  );
}

type SetupRow = {
  id: string;
  name: string;
  circuit_id: string;
  driver_id: string;
  game_version: string | null;
  weather: string | null;
  is_public: boolean;
  updated_at: string;
  circuits: unknown;
};

function GarageGrid({ setups }: { setups: SetupRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {setups.map((s) => {
        const circuit = s.circuits as { name: string; country: string } | null;
        return (
          <SetupCard
            circuitCountry={circuit?.country ?? "—"}
            circuitName={circuit?.name ?? "Unknown circuit"}
            gameVersion={s.game_version}
            id={s.id}
            isPublic={s.is_public}
            key={s.id}
            name={s.name}
            updatedAt={s.updated_at}
            weather={s.weather}
          />
        );
      })}
    </div>
  );
}
