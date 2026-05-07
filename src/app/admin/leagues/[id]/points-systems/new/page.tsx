import "server-only";

import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PointsSystemForm } from "@/components/admin/PointsSystemForm";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function NewPointsSystemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const db = createSupabaseServiceRoleClient();
  const { data: league } = await db
    .from("leagues")
    .select("id, name")
    .eq("id", leagueId)
    .single();

  if (!league) notFound();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        description={`Define a scoring system for ${league.name}`}
        title="New Points System"
      />
      <div className="max-w-xl">
        <PointsSystemForm leagueId={leagueId} />
      </div>
    </div>
  );
}
