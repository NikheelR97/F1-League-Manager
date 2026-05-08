interface PublicPageHeaderProps {
  format: string;
  lastRound: string | null;
  leagueName: string;
  seasonName: string;
  title: string;
  updatedAt: string | null;
}

export function PublicPageHeader({
  format,
  lastRound,
  leagueName,
  seasonName,
  title,
  updatedAt,
}: PublicPageHeaderProps) {
  return (
    <div className="space-y-1 border-b border-f1-border pb-4">
      <p className="text-xs text-f1-muted">
        {leagueName} · {seasonName}
        {lastRound ? ` · ${lastRound}` : ""}
        {" · "}
        <span className="uppercase">{format}</span>
        {updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
      </p>
      <h1 className="text-2xl font-black uppercase text-f1-white">{title}</h1>
    </div>
  );
}
