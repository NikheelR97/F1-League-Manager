import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { pageTitle } from "@/lib/public/page-title";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { loadRoundSummary } from "@/lib/public/round-summary";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  return { title: pageTitle(league ? `Round recap — ${league.name}` : "Round recap") };
}

export default async function RecapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();
  const { summary } = league.season ? await loadRoundSummary(league.id, league.season.id) : { summary: null };

  if (!summary) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <EmptyState message="A recap appears after the first round is published." title="No completed rounds yet" />
      </div>
    );
  }

  // Cache-bust per round so a stale image isn't reused after the next publish.
  const src = `/leagues/${slug}/recap/image.png?r=${summary.roundNumber}`;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-f1-white">Round recap</h1>
          <p className="text-sm text-f1-muted">
            Round {summary.roundNumber} · {summary.roundName}. Download and post it to the group.
          </p>
        </div>
        <a
          className="inline-flex min-h-11 items-center bg-f1-red px-5 text-sm font-bold uppercase tracking-wider text-white hover:bg-f1-red/85"
          download={`${slug}-round-${summary.roundNumber}.png`}
          href={src}
        >
          Download image
        </a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route, next/image adds nothing */}
      <img
        alt={`Round ${summary.roundNumber} recap: podium and standings`}
        className="w-full border border-f1-border"
        height={1200}
        src={src}
        width={1200}
      />
    </div>
  );
}
