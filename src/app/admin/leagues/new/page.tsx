import "server-only";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LeagueForm } from "@/components/admin/LeagueForm";

export default function NewLeaguePage() {
  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Configure the league format, scoring, and branding."
        title="New League"
      />
      <div className="max-w-xl">
        <LeagueForm />
      </div>
    </div>
  );
}
