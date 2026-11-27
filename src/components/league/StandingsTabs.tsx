import Link from "next/link";

// Drivers / Constructors switch; keeps the selected season across the toggle.
export function StandingsTabs({
  active,
  seasonId,
  slug,
}: {
  active: "drivers" | "constructors";
  seasonId: string;
  slug: string;
}) {
  return (
    <nav aria-label="Standings type" className="flex border-b border-f1-border">
      {(["drivers", "constructors"] as const).map((tab) => (
        <Link
          key={tab}
          aria-current={tab === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-4 py-2 text-xs font-bold uppercase tracking-wider ${
            tab === active
              ? "border-f1-red text-f1-white"
              : "border-transparent text-f1-muted hover:text-f1-white"
          }`}
          href={`/leagues/${slug}/standings/${tab}?season=${seasonId}`}
        >
          {tab}
        </Link>
      ))}
    </nav>
  );
}
