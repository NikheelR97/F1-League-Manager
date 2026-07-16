"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Season {
  id: string;
  name: string;
}

interface Props {
  seasons: Season[];
  selectedSeasonId: string;
}

export function SeasonSelector({ seasons, selectedSeasonId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("season_id", e.target.value);
    router.push(`?${p.toString()}`);
  }

  if (seasons.length <= 1) return null;

  return (
    <select
      aria-label="Select season"
      className="border border-f1-border bg-f1-dark px-3 py-1.5 text-sm text-f1-white"
      onChange={handleChange}
      value={selectedSeasonId}
    >
      {seasons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
