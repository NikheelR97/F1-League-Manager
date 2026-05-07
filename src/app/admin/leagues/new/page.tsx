import "server-only";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LeagueForm } from "@/components/admin/LeagueForm";
import { MAX_SEASONS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function NewLeaguePage() {
  const db = createSupabaseServiceRoleClient();
  const { data: seasons } = await db
    .from("seasons")
    .select("id, name")
    .order("starts_on", { ascending: false })
    .limit(MAX_SEASONS_LIST);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Configure the league format, scoring, and branding."
        title="New League"
      />
      <div className="max-w-xl">
        <LeagueForm seasons={seasons ?? []} />
      </div>
    </div>
  );
}
