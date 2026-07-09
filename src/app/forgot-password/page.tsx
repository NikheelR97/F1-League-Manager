import { KeyRound } from "lucide-react";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-f1-black px-4 py-10 text-f1-white sm:px-6">
      <section className="w-full max-w-md border border-f1-border bg-f1-black p-6 shadow-2xl shadow-black/40">
        <div className="mb-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-f1-red-text">
            <KeyRound aria-hidden="true" size={14} />
            Password reset
          </p>
          <h1 className="mt-1 text-2xl font-black uppercase text-f1-white">
            Forgot your password?
          </h1>
          <p className="mt-2 text-sm text-f1-silver">
            Enter the email on your account and we&apos;ll send you a link to reset it.
          </p>
        </div>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
