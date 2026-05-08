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
      <LeagueSubNav slug={slug} />
      {children}
    </>
  );
}
