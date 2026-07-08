import { Flag } from "lucide-react";

interface EmptyStateProps {
  message: string;
  title: string;
}

export function EmptyState({ message, title }: EmptyStateProps) {
  return (
    <section className="border border-dashed border-f1-border p-6 text-f1-silver">
      <Flag aria-hidden="true" className="mb-4 text-f1-red" />
      <h2 className="text-xl font-bold text-f1-white">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6">{message}</p>
    </section>
  );
}
