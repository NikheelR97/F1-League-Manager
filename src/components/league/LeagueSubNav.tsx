"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface LeagueSubNavProps {
  slug: string;
  isWheelLeague: boolean;
}

type NavLink = { href: string; label: string; children?: NavLink[] };

// Five top-level tabs fit a phone without scrolling; Penalties and Wheel live
// as a second row under Results and Calendar.
export function LeagueSubNav({ slug, isWheelLeague }: LeagueSubNavProps) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Bring the active tab into view on narrow screens (scroll only the strip, not the page).
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && scroller.current) scroller.current.scrollLeft = el.offsetLeft - 16;
  }, [pathname]);
  const base = `/leagues/${slug}`;

  const links: NavLink[] = [
    { href: base, label: "Hub" },
    { href: `${base}/standings`, label: "Standings" },
    {
      href: `${base}/results`,
      label: "Results",
      children: [
        { href: `${base}/results`, label: "Results" },
        { href: `${base}/penalties`, label: "Penalties" },
      ],
    },
    {
      href: `${base}/calendar`,
      label: "Calendar",
      children: isWheelLeague
        ? [
            { href: `${base}/calendar`, label: "Calendar" },
            { href: `${base}/wheel`, label: "Wheel" },
          ]
        : undefined,
    },
    { href: `${base}/stats`, label: "Stats" },
  ];

  const under = (href: string) =>
    href === base ? pathname === base : pathname === href || pathname.startsWith(href + "/");
  const isActive = (l: NavLink) => under(l.href) || (l.children ?? []).some((c) => under(c.href));
  const section = links.find((l) => l.children && isActive(l));

  return (
    <nav aria-label="League navigation" className="border-b border-f1-border bg-f1-black/95">
      <div
        className="mx-auto flex w-full max-w-7xl gap-0 overflow-x-auto px-2 [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] sm:px-6 md:[mask-image:none] lg:px-8 [&::-webkit-scrollbar]:hidden"
        ref={scroller}
      >
        {links.map((link) => {
          const active = isActive(link);
          return (
            <Link
              key={link.href}
              aria-current={active ? "page" : undefined}
              href={link.href}
              className={`min-h-11 inline-flex shrink-0 items-center border-b-2 px-3 py-3 text-xs font-bold uppercase transition-colors sm:px-4 ${
                active ? "border-f1-red text-f1-white" : "border-transparent text-f1-muted hover:text-f1-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      {section?.children ? (
        <div className="border-t border-f1-border/60 bg-black/30">
          <div aria-label={`${section.label} sections`} className="mx-auto flex w-full max-w-7xl px-2 sm:px-6 lg:px-8" role="group">
            {section.children.map((c) => {
              const active = pathname === c.href || pathname.startsWith(c.href + "/");
              return (
                <Link
                  key={c.href}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex min-h-10 items-center px-3 text-[11px] font-semibold uppercase tracking-wider sm:px-4 ${
                    active ? "text-f1-white" : "text-f1-muted hover:text-f1-white"
                  }`}
                  href={c.href}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
