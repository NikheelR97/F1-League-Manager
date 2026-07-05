import { PublicHeader } from "@/components/layout/PublicHeader";
import { LeagueSubNav } from "@/components/league/LeagueSubNav";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <>
      <PublicHeader />
      <LeagueSubNav slug={slug} />
      <main id="main-content">{children}</main>
    </>
  );
}
