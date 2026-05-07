import { LeagueHub } from "@/components/league/LeagueHub";
import { getLeagueSummaries } from "@/lib/ui/league-data";

interface LeaguePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getLeagueSummaries().map((league) => ({ slug: league.slug }));
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { slug } = await params;

  return <LeagueHub slug={slug} />;
}
