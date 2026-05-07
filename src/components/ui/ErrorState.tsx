import { TriangleAlert } from "lucide-react";

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <section className="border border-f1-red bg-f1-panel p-6 text-f1-white">
      <TriangleAlert aria-hidden="true" className="mb-4 text-f1-red" />
      <h2 className="text-xl font-bold">Race Control Alert</h2>
      <p className="mt-2 text-sm leading-6 text-f1-silver">{message}</p>
    </section>
  );
}
