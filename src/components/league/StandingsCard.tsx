import { formatDate } from "@/lib/format-date";

interface StandingsCardProps {
  children: React.ReactNode;
  footerNote: string;
  lastRound: string | null;
  leagueName: string;
  seasonName: string;
  /**
   * Host shown in the footer so a shared screenshot says where to find the
   * standings. Long auto-generated hosts (Vercel preview URLs) are dropped
   * rather than cluttering the card — only a short real domain earns the space.
   */
  siteLabel?: string;
  title: string;
  updatedAt: string | null;
}

/**
 * Self-contained shell for the standings tables.
 *
 * League members screenshot these to post in Discord / WhatsApp, so the card
 * carries its own identity (league, season, round, updated) — a crop of just
 * this card still says what it is, and the strong header/footer edges give the
 * screenshot a natural boundary to cut on.
 */
export function StandingsCard({
  children,
  footerNote,
  lastRound,
  leagueName,
  seasonName,
  siteLabel,
  title,
  updatedAt,
}: StandingsCardProps) {
  return (
    <section className="overflow-hidden border border-f1-border bg-f1-dark">
      <header className="flex items-end justify-between gap-4 border-b-2 border-f1-red bg-[linear-gradient(90deg,rgba(232,0,45,0.14),transparent_62%)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-xl font-black uppercase leading-none tracking-tight text-f1-white sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1.5 text-xs font-semibold text-f1-silver sm:text-[13px]">
            {seasonName}
            {lastRound ? ` · After ${lastRound}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-black uppercase tracking-wider text-f1-red-text sm:text-[13px]">
            {leagueName}
          </p>
          {updatedAt ? (
            <p className="mt-0.5 font-mono text-[10px] text-f1-muted sm:text-[11px]">
              Updated {formatDate(updatedAt)}
            </p>
          ) : null}
        </div>
      </header>

      {children}

      <footer className="flex items-center justify-between gap-3 border-t border-f1-border bg-black/25 px-4 py-2.5 sm:px-5">
        <span className="text-[10px] text-f1-muted sm:text-[10.5px]">{footerNote}</span>
        {siteLabel && siteLabel.length <= 32 ? (
          <span className="hidden font-mono text-[10px] text-f1-muted sm:inline sm:text-[10.5px]">
            {siteLabel}
          </span>
        ) : null}
      </footer>
    </section>
  );
}
