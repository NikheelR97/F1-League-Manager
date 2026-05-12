"use client";

import { useRouter } from "next/navigation";

interface Season {
  id: string;
  name: string;
}

interface SeasonSelectorProps {
  seasons: Season[];
  currentSeasonId: string;
  /** Current page pathname — season param is appended here */
  pathname: string;
}

export function SeasonSelector({
  seasons,
  currentSeasonId,
  pathname,
}: SeasonSelectorProps) {
  const router = useRouter();

  if (seasons.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value;
    const url = selected
      ? `${pathname}?season=${selected}`
      : pathname;
    router.push(url);
  }

  return (
    <div className="flex items-center gap-2">
      <label
        className="text-xs font-bold uppercase text-f1-muted"
        htmlFor="season-selector"
      >
        Season
      </label>
      <select
        className="border border-f1-border bg-f1-dark px-2 py-1 text-xs text-f1-white focus:border-f1-red focus:outline-none"
        defaultValue={currentSeasonId}
        id="season-selector"
        onChange={handleChange}
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
