import "server-only";

import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MAX_DRIVERS_LIST } from "@/lib/constants";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export default async function DriversPage() {
  const db = createSupabaseServiceRoleClient();
  const { data: drivers } = await db
    .from("drivers")
    .select("id, display_name, racing_number, country, is_active")
    .order("display_name")
    .limit(MAX_DRIVERS_LIST);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          description="Global driver pool. Assign drivers to leagues from the league hub."
          title="Drivers"
        />
        <Link
          className="flex items-center gap-2 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black"
          href="/admin/drivers/new"
        >
          <Plus aria-hidden="true" size={16} />
          New Driver
        </Link>
      </div>

      {!drivers?.length ? (
        <p className="text-sm text-f1-muted">No drivers yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {drivers.map((driver) => (
            <li key={driver.id}>
              <div className="flex items-center justify-between border border-f1-border bg-f1-dark p-4">
                <div>
                  <p className="font-bold text-f1-white">{driver.display_name}</p>
                  <p className="font-mono text-xs text-f1-muted">
                    {driver.racing_number ? `#${driver.racing_number}` : "—"}
                    {driver.country ? ` · ${driver.country}` : ""}
                  </p>
                </div>
                {!driver.is_active && (
                  <span className="border border-f1-muted px-2 py-0.5 text-xs font-bold uppercase text-f1-muted">
                    Inactive
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
