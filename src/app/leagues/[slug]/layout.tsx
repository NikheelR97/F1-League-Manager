import "server-only";

import { notFound } from "next/navigation";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { LeagueSubNav } from "@/components/league/LeagueSubNav";
import { getNavLeagueLinks } from "@/lib/public/nav-league-links";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

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
  const navLeagueLinks = await getNavLeagueLinks(createSupabaseServiceRoleClient());

  return (
    <>
      <PublicHeader leagueLinks={navLeagueLinks} />
      <LeagueSubNav slug={slug} isWheelLeague={isWheelLeague} />
      <main id="main-content">{children}</main>
    </>
  );
}
