import { ClipboardList, FileUp, Flag, LayoutDashboard, Menu, ShieldCheck, Trophy, Users } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/SignOutButton";
import type { ProfileRole } from "@/lib/auth/roles";

interface AdminShellProps {
  children: React.ReactNode;
  role: ProfileRole;
}

const baseNavItems = [
  { href: "/admin/leagues", icon: Trophy, label: "Leagues" },
  { href: "/admin/seasons", icon: LayoutDashboard, label: "Seasons" },
  { href: "/admin/drivers", icon: Users, label: "Drivers" },
  { href: "/admin/reserves", icon: Flag, label: "Reserves" },
  { href: "/admin/audit", icon: ClipboardList, label: "Audit Log" },
  { href: "/admin/import", icon: FileUp, label: "Import" },
] as const;

const superAdminNavItems = [
  { href: "/admin/users", icon: ShieldCheck, label: "User Roles" },
] as const;

export function AdminShell({ children, role }: AdminShellProps) {
  const navItems = role === "super_admin" ? [...baseNavItems, ...superAdminNavItems] : baseNavItems;

  return (
    <div className="theme-race-control flex min-h-screen bg-f1-dark text-f1-white">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-f1-border focus:bg-f1-dark focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:uppercase focus:text-f1-white"
        href="#main-content"
      >
        Skip to content
      </a>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-f1-border bg-f1-black md:flex">
        <div className="flex min-h-16 items-center gap-2 border-b border-f1-border px-4">
          <Trophy aria-hidden="true" className="text-f1-red" size={20} />
          <span className="text-sm font-black uppercase tracking-wide">
            Race Control
          </span>
        </div>
        <nav aria-label="Admin navigation" className="flex flex-col gap-1 p-2">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              className="flex items-center gap-3 rounded-none border border-transparent px-3 py-2 text-sm font-bold uppercase text-f1-silver transition-colors hover:border-f1-border hover:bg-f1-dark hover:text-f1-white"
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-f1-border p-4">
          <p className="text-xs font-bold uppercase text-f1-muted">{role}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-3 border-b border-f1-border bg-f1-black px-6 md:hidden">
          <Trophy aria-hidden="true" className="text-f1-red" size={20} />
          <span className="text-sm font-black uppercase">Race Control</span>
          <details className="relative ml-auto md:hidden">
            <summary
              aria-label="Open navigation"
              className="flex h-11 w-11 cursor-pointer items-center justify-center border border-f1-border text-f1-white"
            >
              <Menu aria-hidden="true" size={20} />
            </summary>
            <nav className="absolute right-0 top-12 z-10 grid w-52 gap-1 border border-f1-border bg-f1-panel p-2">
              {navItems.map(({ href, icon: Icon, label }) => (
                <Link
                  className="flex min-h-11 items-center gap-3 px-3 py-3 text-sm font-bold uppercase text-f1-white"
                  href={href}
                  key={href}
                >
                  <Icon aria-hidden="true" size={16} />
                  {label}
                </Link>
              ))}
            </nav>
          </details>
          <div className="w-32">
            <SignOutButton className="mt-0" />
          </div>
        </header>
        <main className="flex-1 p-6" id="main-content">{children}</main>
      </div>
    </div>
  );
}
