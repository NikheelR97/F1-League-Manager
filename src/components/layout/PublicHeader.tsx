import { Menu, Trophy } from "lucide-react";
import Link from "next/link";

import { MAX_NAV_LINKS } from "@/lib/constants";
import { getLeagueSummaries } from "@/lib/ui/league-data";

const navLinks = [
  { href: "/", label: "Leagues" },
  { href: "/leagues/informal", label: "Informal" },
  { href: "/leagues/standard", label: "Standard" },
] as const;

export function PublicHeader() {
  const leagues = getLeagueSummaries();
  const boundedLinks = navLinks.slice(0, MAX_NAV_LINKS);

  return (
    <header className="border-b border-f1-border bg-f1-black/95">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3 text-f1-white" href="/">
          <Trophy aria-hidden="true" className="text-f1-red" size={24} />
          <span className="text-lg font-black uppercase">F1 League Manager</span>
        </Link>
        <nav aria-label="Primary navigation" className="hidden gap-6 md:flex">
          {boundedLinks.map((link) => (
            <Link
              className="text-sm font-bold uppercase text-f1-silver hover:text-f1-white"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <details className="relative md:hidden">
          <summary className="flex h-11 w-11 cursor-pointer items-center justify-center border border-f1-border text-f1-white">
            <Menu aria-label="Open navigation" size={20} />
          </summary>
          <nav className="absolute right-0 top-12 z-10 grid w-52 gap-1 border border-f1-border bg-f1-panel p-2">
            {leagues.map((league) => (
              <Link
                className="px-3 py-2 text-sm font-bold uppercase text-f1-white"
                href={league.href}
                key={league.slug}
              >
                {league.name}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
