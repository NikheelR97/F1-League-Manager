import { Menu, Trophy } from "lucide-react";
import Link from "next/link";

import { MAX_NAV_LINKS } from "@/lib/constants";

const navLinks = [
  { href: "/", label: "Leagues" },
  { href: "/leagues/informal", label: "Informal" },
  { href: "/leagues/standard", label: "Standard" },
  // ponytail: PublicHeader is a plain server component with no session
  // lookup wired in — rather than plumb auth state through every public
  // page just for this link, always show it and let /garage's own
  // redirect-to-login handle signed-out visitors. Revisit if a session
  // check becomes cheap/available here for real (e.g. via a shared layout).
  { href: "/garage", label: "Garage" },
] as const;

export function PublicHeader() {
  const boundedLinks = navLinks.slice(0, MAX_NAV_LINKS);

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-f1-border focus:bg-f1-dark focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:uppercase focus:text-f1-white"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="border-b border-f1-border bg-f1-black/95">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="inline-flex items-center gap-3 min-h-11 text-f1-white" href="/">
            <Trophy aria-hidden="true" className="text-f1-red" size={24} />
            <span className="text-lg font-black uppercase">F1 League Manager</span>
          </Link>
          <nav aria-label="Primary navigation" className="hidden gap-6 md:flex">
            {boundedLinks.map((link) => (
              <Link
                className="inline-flex items-center min-h-11 text-sm font-bold uppercase text-f1-silver hover:text-f1-white"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <details className="relative md:hidden">
            <summary
              aria-label="Open navigation"
              className="flex h-11 w-11 cursor-pointer items-center justify-center border border-f1-border text-f1-white"
            >
              <Menu aria-hidden="true" size={20} />
            </summary>
            <nav className="absolute right-0 top-12 z-10 grid w-52 gap-1 border border-f1-border bg-f1-panel p-2">
              {boundedLinks.map((link) => (
                <Link
                  className="min-h-11 px-3 py-3 text-sm font-bold uppercase text-f1-white"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </header>
    </>
  );
}
