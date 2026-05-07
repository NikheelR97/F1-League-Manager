export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 py-12 text-white">
      <section className="w-full max-w-3xl border-l-4 border-[#e8002d] bg-[#15151e] p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c8c8c8]">
          Sprint 0
        </p>
        <h1 className="mt-3 text-4xl font-bold">
          F1 Esports League Manager
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#c8c8c8]">
          Project foundation is being prepared. League features remain locked
          behind the approved sprint plan until their sprint begins.
        </p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="border border-[#2f2f2f] p-4">
            <dt className="text-xs uppercase text-[#6c6c6c]">Branch</dt>
            <dd className="mt-2 font-mono text-sm">dev</dd>
          </div>
          <div className="border border-[#2f2f2f] p-4">
            <dt className="text-xs uppercase text-[#6c6c6c]">Database</dt>
            <dd className="mt-2 font-mono text-sm">local Supabase</dd>
          </div>
          <div className="border border-[#2f2f2f] p-4">
            <dt className="text-xs uppercase text-[#6c6c6c]">Gate</dt>
            <dd className="mt-2 font-mono text-sm">sprint-verify</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
