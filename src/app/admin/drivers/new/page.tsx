import "server-only";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DriverForm } from "@/components/admin/DriverForm";

export default function NewDriverPage() {
  return (
    <div className="space-y-8">
      <AdminPageHeader
        description="Add a driver to the global pool. Then assign them to a league from the league hub."
        title="New Driver"
      />
      <div className="max-w-xl">
        <DriverForm />
      </div>
    </div>
  );
}
