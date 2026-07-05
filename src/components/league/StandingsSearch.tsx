"use client";

export function StandingsSearch({ label = "Find a driver..." }: { label?: string }) {
  return (
    <input
      type="search"
      placeholder={label}
      aria-label={label}
      className="h-10 w-full min-w-0 rounded-lg border border-f1-border bg-f1-dark/50 px-2.5 py-1 text-base text-f1-white placeholder:text-f1-muted focus:border-f1-red min-h-11"
      onChange={(e) => {
        const query = e.currentTarget.value.toLowerCase();
        // ponytail: DOM-filter keeps the page a server component; lift to state if standings ever paginate
        document.querySelectorAll<HTMLElement>("[data-driver-name]").forEach((row) => {
          row.classList.toggle("hidden", !(row.dataset.driverName ?? "").includes(query));
        });
      }}
    />
  );
}
