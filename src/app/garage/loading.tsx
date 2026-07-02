export default function GarageLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 border border-f1-border bg-f1-dark" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-48 border border-f1-border bg-f1-dark" />
        <div className="h-48 border border-f1-border bg-f1-dark" />
        <div className="h-48 border border-f1-border bg-f1-dark" />
      </div>
    </div>
  );
}
