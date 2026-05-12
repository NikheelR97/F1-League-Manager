import "server-only";

import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SeasonForm } from "@/components/admin/SeasonForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { MAX_SEASONS_LIST } from "@/lib/constants";

export default async function SeasonsPage() {
  const db = createSupabaseServiceRoleClient();
  const { data: seasons, error: seasonsError } = await db
    .from("seasons")
    .select("id, name, starts_on, ends_on, is_current, is_archived")
    .order("starts_on", { ascending: false })
    .limit(MAX_SEASONS_LIST);

  if (seasonsError) {
    return <ErrorState message="Failed to load seasons." />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Seasons group leagues and results into time periods."
        title="Seasons"
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-4 text-sm font-bold uppercase text-f1-muted">
            All Seasons
          </h2>
          {!seasons?.length ? (
            <p className="text-sm text-f1-muted">No seasons yet.</p>
          ) : (
            <ul className="space-y-2">
              {seasons.map((s) => (
                <li
                  className="flex items-center justify-between border border-f1-border bg-f1-dark p-4"
                  key={s.id}
                >
                  <Link
                    className="flex-1 hover:underline"
                    href={`/admin/seasons/${s.id}`}
                  >
                    <p className="font-bold text-f1-white">{s.name}</p>
                    <p className="font-mono text-xs text-f1-muted">
                      {s.starts_on}
                      {s.ends_on ? ` → ${s.ends_on}` : " → ongoing"}
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    {s.is_current && (
                      <span className="border border-f1-red px-2 py-0.5 text-xs font-bold uppercase text-f1-red">
                        Current
                      </span>
                    )}
                    {s.is_archived && (
                      <span className="border border-f1-border px-2 py-0.5 text-xs font-bold uppercase text-f1-muted">
                        Archived
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-f1-muted">
            <Plus aria-hidden="true" size={14} />
            New Season
          </h2>
          <SeasonForm />
        </section>
      </div>
    </div>
  );
}
