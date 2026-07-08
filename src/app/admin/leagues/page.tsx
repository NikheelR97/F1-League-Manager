import "server-only";

import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { MAX_LEAGUES_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function LeaguesPage() {
  const db = createSupabaseServiceRoleClient();
  const { data: leagues, error: leaguesError } = await db
    .from("leagues")
    .select("id, name, slug, format, status, seasons(name)")
    .order("created_at", { ascending: false })
    .limit(MAX_LEAGUES_LIST);

  if (leaguesError) {
    return <ErrorState message="Failed to load leagues." />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          description="Manage leagues, teams, drivers, and results."
          title="Leagues"
        />
        <Link
          className="flex items-center gap-2 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
          href="/admin/leagues/new"
        >
          <Plus aria-hidden="true" size={16} />
          New League
        </Link>
      </div>
      {!leagues?.length ? (
        <p className="text-sm text-f1-muted">No leagues yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {leagues.map((league) => (
            <li key={league.id}>
              <Link
                className="flex items-center justify-between border border-f1-border bg-f1-dark p-4 transition-colors hover:border-f1-red"
                href={`/admin/leagues/${league.id}`}
              >
                <div>
                  <p className="font-bold text-f1-white">{league.name}</p>
                  <p className="font-mono text-xs text-f1-muted">
                    {league.slug} · {league.format} ·{" "}
                    {(league.seasons as unknown as { name: string } | null)?.name ?? "—"}
                  </p>
                </div>
                <span
                  className={`border px-2 py-0.5 text-xs font-bold uppercase ${
                    league.status === "active"
                      ? "border-team-sauber text-team-sauber"
                      : "border-f1-muted text-f1-muted"
                  }`}
                >
                  {league.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
