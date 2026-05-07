import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/Button";
import { RaceFormatTag } from "@/components/ui/RaceFormatTag";
import { StatusPill } from "@/components/ui/StatusPill";
import type { LeagueSummary } from "@/lib/ui/league-data";

interface LeagueCardProps {
  league: LeagueSummary;
}

export function LeagueCard({ league }: LeagueCardProps) {
  return (
    <article className="grid min-h-[320px] overflow-hidden border border-f1-border bg-f1-panel md:grid-cols-[1fr_1.2fr]">
      <div className="relative min-h-48">
        <Image
          alt={league.heroAlt}
          className="object-cover"
          fill
          priority={league.slug === "informal"}
          sizes="(min-width: 768px) 45vw, 100vw"
          src={league.heroImage}
        />
      </div>
      <div className="flex flex-col justify-between gap-6 p-6">
        <div>
          <div className="flex flex-wrap gap-3">
            <StatusPill tone="red">{league.status}</StatusPill>
            <RaceFormatTag>{league.formatLabel}</RaceFormatTag>
          </div>
          <h2 className="mt-5 text-3xl font-black uppercase">{league.name}</h2>
          <p className="mt-3 text-sm leading-6 text-f1-silver">
            Next operational focus: {league.nextRace}. Public standings and
            results unlock as admins publish race data.
          </p>
        </div>
        <Button href={league.href} icon={ArrowRight}>
          Open League
        </Button>
      </div>
    </article>
  );
}
