import { Car, Gauge, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/SignOutButton";

interface GarageShellProps {
  children: React.ReactNode;
  displayName: string;
}

const navItems = [
  { href: "/garage", icon: LayoutGrid, label: "My Setups" },
  { href: "/garage/new", icon: Car, label: "New Setup" },
] as const;

export function GarageShell({ children, displayName }: GarageShellProps) {
  return (
    <div className="theme-driver-garage flex min-h-screen bg-f1-dark text-f1-white">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-f1-border bg-f1-black md:flex">
        <div className="flex min-h-16 items-center gap-2 border-b border-f1-border px-4">
          <Gauge aria-hidden="true" className="text-f1-red" size={20} />
          <span className="text-sm font-black uppercase tracking-wide">
            Driver Garage
          </span>
        </div>
        <nav aria-label="Garage navigation" className="flex flex-col gap-1 p-2">
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
          <p className="text-xs font-bold uppercase text-f1-muted">{displayName}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex min-h-16 items-center border-b border-f1-border bg-f1-black px-6 md:hidden">
          <Gauge aria-hidden="true" className="text-f1-red" size={20} />
          <span className="ml-2 text-sm font-black uppercase">Driver Garage</span>
          <div className="ml-auto w-32">
            <SignOutButton className="mt-0" />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
