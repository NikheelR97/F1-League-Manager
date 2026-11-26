"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface LeagueSubNavProps {
  slug: string;
  isWheelLeague: boolean;
}

export function LeagueSubNav({ slug, isWheelLeague }: LeagueSubNavProps) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Bring the active tab into view on narrow screens (scroll only the strip, not the page).
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && scroller.current) scroller.current.scrollLeft = el.offsetLeft - 16;
  }, [pathname]);
  const base = `/leagues/${slug}`;

  const links = [
    { href: base, label: "Hub", activePath: base },
    { href: `${base}/calendar`, label: "Calendar", activePath: `${base}/calendar` },
    ...(isWheelLeague ? [{ href: `${base}/wheel`, label: "Wheel", activePath: `${base}/wheel` }] : []),
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
      <div
        className="mx-auto flex w-full max-w-7xl gap-0 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] sm:px-6 md:[mask-image:none] lg:px-8 [&::-webkit-scrollbar]:hidden"
        ref={scroller}
      >
        {links.map((link) => {
          const isActive =
            link.activePath === base
              ? pathname === base
              : pathname === link.activePath || pathname.startsWith(link.activePath + "/");
          return (
            <Link
              key={link.href}
              aria-current={isActive ? "page" : undefined}
              href={link.href}
              className={`min-h-11 inline-flex shrink-0 items-center border-b-2 px-4 py-3 text-xs font-bold uppercase transition-colors ${
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
