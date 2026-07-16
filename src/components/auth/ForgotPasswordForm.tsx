"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
});

type ForgotPasswordFields = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const confirmationRef = useFocusOnMount<HTMLParagraphElement>(submitted);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ForgotPasswordFields>({
    defaultValues: { email: "" },
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordFields) {
    try {
      const supabase = createSupabaseBrowserClient();
      // Use the browser's actual origin as the redirect base so the recovery
      // link always returns to the exact host the user is on (localhost /
      // staging / prod / Vercel preview). This avoids depending on
      // NEXT_PUBLIC_SITE_URL being configured per-environment — an unset value
      // falls back to the ephemeral per-deployment Vercel URL, which sends the
      // link to a throwaway *.vercel.app host. Every real origin is covered by
      // the Supabase redirect allowlist.
      await supabase.auth.resetPasswordForEmail(values.email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
    } catch {
      // Swallow all failures (network, misconfig, etc). Neither a Supabase
      // error nor a thrown exception may change what the user sees — a
      // distinct error state here would let an attacker tell registered
      // emails from unregistered ones.
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p
        className="border border-f1-border bg-f1-dark p-3 text-sm text-f1-silver"
        ref={confirmationRef}
        role="status"
        tabIndex={-1}
      >
        If an account exists for that email, we&apos;ve sent a reset link. Check your inbox.
      </p>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1.5">
        <Label className="text-f1-silver" htmlFor="forgot-email">
          Email
        </Label>
        <Input
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
          aria-invalid={!!errors.email}
          autoComplete="email"
          className="h-11 border-f1-border bg-f1-dark text-f1-white placeholder:text-f1-muted focus-visible:border-f1-red"
          id="forgot-email"
          inputMode="email"
          placeholder="you@example.com"
          type="email"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-f1-red-text" id="forgot-email-error">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <button
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-f1-black disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        <span>{isSubmitting ? "Sending..." : "Send reset link"}</span>
      </button>

      <p className="text-center text-xs">
        <Link className="font-bold uppercase text-f1-red-text hover:text-white" href="/login">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
