export default function LeagueHubLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-40 border border-f1-border bg-f1-dark" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 border border-f1-border bg-f1-dark" />
        <div className="h-64 border border-f1-border bg-f1-dark" />
      </div>
    </div>
  );
}
