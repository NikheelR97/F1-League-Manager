import Link from "next/link";

const TABS = [
  { key: "overview", label: "Overview", path: "standings" },
  { key: "drivers", label: "Drivers", path: "standings/drivers" },
  { key: "constructors", label: "Constructors", path: "standings/constructors" },
] as const;

// Standings view switch; keeps the selected season across tabs. "Recap" leads
// to the downloadable round image.
export function StandingsTabs({
  active,
  seasonId,
  slug,
}: {
  active: (typeof TABS)[number]["key"];
  seasonId: string;
  slug: string;
}) {
  return (
    <nav aria-label="Standings type" className="flex items-end border-b border-f1-border">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          aria-current={tab.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-4 py-2 text-xs font-bold uppercase tracking-wider ${
            tab.key === active
              ? "border-f1-red text-f1-white"
              : "border-transparent text-f1-muted hover:text-f1-white"
          }`}
          href={`/leagues/${slug}/${tab.path}?season=${seasonId}`}
        >
          {tab.label}
        </Link>
      ))}
      <Link
        className="mb-1 ml-auto px-3 py-1 text-xs font-bold uppercase tracking-wider text-f1-red-text hover:text-f1-white"
        href={`/leagues/${slug}/recap`}
      >
        Share recap →
      </Link>
    </nav>
  );
}
