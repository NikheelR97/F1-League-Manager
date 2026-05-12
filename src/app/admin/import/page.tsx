import "server-only";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ImportForm } from "@/components/admin/ImportForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { MAX_LEAGUES_LIST, MAX_SEASONS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function ImportPage() {
  const db = createSupabaseServiceRoleClient();

  const [{ data: leagues, error: leaguesErr }, { data: seasons, error: seasonsErr }] =
    await Promise.all([
      db
        .from("leagues")
        .select("id, name, slug")
        .order("name")
        .limit(MAX_LEAGUES_LIST),
      db
        .from("seasons")
        .select("id, name, starts_on, is_current, is_archived")
        .order("starts_on", { ascending: false })
        .limit(MAX_SEASONS_LIST),
    ]);

  if (leaguesErr || seasonsErr) {
    return <ErrorState message="Failed to load leagues and seasons." />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Upload a Season 2 workbook, validate the diff, then confirm to lock."
        title="Workbook Import"
      />
      <ImportForm leagues={leagues ?? []} seasons={seasons ?? []} />
    </div>
  );
}
