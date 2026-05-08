"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface LeagueSubNavProps {
  slug: string;
}

export function LeagueSubNav({ slug }: LeagueSubNavProps) {
  const pathname = usePathname();
  const base = `/leagues/${slug}`;

  const links = [
    { href: base, label: "Hub", activePath: base },
    { href: `${base}/calendar`, label: "Calendar", activePath: `${base}/calendar` },
    { href: `${base}/wheel`, label: "Wheel", activePath: `${base}/wheel` },
    { href: `${base}/standings/drivers`, label: "Standings", activePath: `${base}/standings` },
    { href: `${base}/results`, label: "Results", activePath: `${base}/results` },
    { href: `${base}/penalties`, label: "Penalties", activePath: `${base}/penalties` },
    { href: `${base}/stats`, label: "Stats", activePath: `${base}/stats` },
  ];

  return (
    <nav
      aria-label="League navigation"
      className="border-b border-f1-border bg-f1-black/95"
    >
      <div className="mx-auto flex w-full max-w-7xl gap-0 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {links.map((link) => {
          const isActive =
            link.activePath === base
              ? pathname === base
              : pathname === link.activePath || pathname.startsWith(link.activePath + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 border-b-2 px-4 py-3 text-xs font-bold uppercase transition-colors ${
                isActive
                  ? "border-f1-red text-f1-white"
                  : "border-transparent text-f1-muted hover:text-f1-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
