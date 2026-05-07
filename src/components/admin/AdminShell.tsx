import { Flag, LayoutDashboard, Trophy, Users } from "lucide-react";
import Link from "next/link";

import type { ProfileRole } from "@/lib/auth/roles";

interface AdminShellProps {
  children: React.ReactNode;
  role: ProfileRole;
}

const navItems = [
  { href: "/admin/leagues", icon: Trophy, label: "Leagues" },
  { href: "/admin/seasons", icon: LayoutDashboard, label: "Seasons" },
  { href: "/admin/drivers", icon: Users, label: "Drivers" },
  { href: "/admin/reserves", icon: Flag, label: "Reserves" },
] as const;

export function AdminShell({ children, role }: AdminShellProps) {
  return (
    <div className="theme-race-control flex min-h-screen bg-f1-dark text-f1-white">
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
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex min-h-16 items-center border-b border-f1-border bg-f1-black px-6 md:hidden">
          <Trophy aria-hidden="true" className="text-f1-red" size={20} />
          <span className="ml-2 text-sm font-black uppercase">Race Control</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
