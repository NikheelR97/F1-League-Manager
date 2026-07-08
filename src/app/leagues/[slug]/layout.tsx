import "server-only";

import { notFound } from "next/navigation";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { LeagueSubNav } from "@/components/league/LeagueSubNav";
import { resolvePublicLeague } from "@/lib/public/resolve-league";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league) notFound();

  const isWheelLeague = league.format === "standard";

  return (
    <>
      <PublicHeader />
      <LeagueSubNav slug={slug} isWheelLeague={isWheelLeague} />
      <main id="main-content">{children}</main>
    </>
  );
}
