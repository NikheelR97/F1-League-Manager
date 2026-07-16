import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";

interface NavLink {
  href: string;
  label: string;
}

interface PublicShellProps {
  children: React.ReactNode;
  leagueLinks?: NavLink[];
}

export function PublicShell({ children, leagueLinks = [] }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-f1-black text-f1-white">
      <PublicHeader leagueLinks={leagueLinks} />
      <main className="flex-1" id="main-content" tabIndex={-1}>{children}</main>
      <PublicFooter />
    </div>
  );
}
