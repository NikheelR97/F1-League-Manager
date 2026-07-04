import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { F1Button } from "@/components/ui/F1Button";
import { RaceFormatTag } from "@/components/ui/RaceFormatTag";
import { StatusPill } from "@/components/ui/StatusPill";
import type { LeagueSummary } from "@/lib/ui/league-data";

interface LeagueCardProps {
  league: LeagueSummary;
  priority?: boolean;
}

export function LeagueCard({ league, priority = false }: LeagueCardProps) {
  return (
    <article className="grid min-h-48 overflow-hidden border border-f1-border bg-f1-panel md:min-h-[320px] md:grid-cols-[1fr_1.2fr]">
      <div className="relative min-h-48">
        <Image
          alt={league.heroAlt}
          className="object-cover"
          fill
          priority={priority}
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
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-bold uppercase text-f1-muted">Next race</dt>
              <dd className="mt-0.5 text-f1-silver">{league.nextRace}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-f1-muted">Drivers&#39; leader</dt>
              <dd className="mt-0.5 text-f1-silver">{league.leader}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-f1-muted">Constructors&#39; leader</dt>
              <dd className="mt-0.5 text-f1-silver">{league.constructorLeader}</dd>
            </div>
          </dl>
        </div>
        <F1Button href={league.href} icon={ArrowRight}>
          Open League
        </F1Button>
      </div>
    </article>
  );
}
