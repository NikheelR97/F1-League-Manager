import "server-only";

import { Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SeasonForm } from "@/components/admin/SeasonForm";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { MAX_SEASONS_LIST } from "@/lib/constants";

export default async function SeasonsPage() {
  const db = createSupabaseServiceRoleClient();
  const { data: seasons } = await db
    .from("seasons")
    .select("id, name, starts_on, ends_on, is_current")
    .order("starts_on", { ascending: false })
    .limit(MAX_SEASONS_LIST);

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
                  <div>
                    <p className="font-bold text-f1-white">{s.name}</p>
                    <p className="font-mono text-xs text-f1-muted">
                      {s.starts_on}
                      {s.ends_on ? ` → ${s.ends_on}` : " → ongoing"}
                    </p>
                  </div>
                  {s.is_current && (
                    <span className="border border-f1-red px-2 py-0.5 text-xs font-bold uppercase text-f1-red">
                      Current
                    </span>
                  )}
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
