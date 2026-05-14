import { Gauge, Trophy } from "lucide-react";

import { LoginForm } from "@/components/auth/LoginForm";
import { getSafeNextPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : null;
  const nextPath = getSafeNextPath(rawNext);

  return (
    <main className="min-h-screen bg-f1-black text-f1-white">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 border border-f1-border bg-f1-dark px-3 py-2 text-xs font-bold uppercase text-f1-silver">
            <Trophy aria-hidden="true" className="text-f1-red" size={16} />
            Race Control Access
          </div>
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-black uppercase leading-tight text-f1-white sm:text-5xl">
              F1 League Manager
            </h1>
            <p className="text-base leading-7 text-f1-silver">
              Sign in to manage race operations, publish results, or open your
              private driver garage.
            </p>
          </div>
          <div className="grid max-w-xl grid-cols-1 gap-3 text-sm text-f1-silver sm:grid-cols-2">
            <div className="border border-f1-border bg-f1-dark p-4">
              <Gauge aria-hidden="true" className="mb-3 text-f1-red" size={20} />
              <p className="font-bold uppercase text-f1-white">Admin</p>
              <p className="mt-1 text-xs text-f1-muted">
                Create seasons, publish results, run imports, and audit changes.
              </p>
            </div>
            <div className="border border-f1-border bg-f1-dark p-4">
              <Gauge aria-hidden="true" className="mb-3 text-f1-red" size={20} />
              <p className="font-bold uppercase text-f1-white">Racer</p>
              <p className="mt-1 text-xs text-f1-muted">
                Manage private setups and keep race-week notes in one place.
              </p>
            </div>
          </div>
        </section>

        <section className="border border-f1-border bg-f1-black p-6 shadow-2xl shadow-black/40">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase text-f1-red">Secure sign in</p>
            <h2 className="mt-1 text-2xl font-black uppercase text-f1-white">
              Welcome back
            </h2>
          </div>
          <LoginForm nextPath={nextPath} />
        </section>
      </div>
    </main>
  );
}
