import { formatPosition } from "@/lib/public/format-position";

export interface FormResult {
  status: string;
  position: number | null;
}

const PODIUM = ["bg-podium-gold text-black", "bg-podium-silver text-black", "bg-podium-bronze text-black"];

/** Compact strip of recent finishes, newest first. Pure CSS. */
export function FormStrip({ results }: { results: FormResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-f1-muted">Form</span>
      <ol aria-label="Recent finishes, newest first" className="flex gap-1">
        {results.map((r, i) => {
          const podium = r.status === "classified" && r.position !== null && r.position <= 3;
          const label = r.status === "dnf" ? "DNF" : formatPosition(r.status, r.position);
          return (
            <li
              key={i}
              className={`min-w-9 px-1.5 py-1 text-center font-mono text-xs font-bold ${
                podium ? PODIUM[(r.position as number) - 1] : "border border-f1-border bg-f1-dark text-f1-white"
              }`}
            >
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
