import "server-only";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function ReservesPage() {
  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Reserve driver assignments are managed per race from the league hub once race sessions are set up."
        title="Reserves"
      />
      <p className="text-sm text-f1-muted">
        Navigate to a league, open a race session, and use the reserve assignment form to
        record which reserve covered an absent primary driver.
      </p>
    </div>
  );
}
