"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusOnMount } from "@/lib/hooks/use-focus-on-mount";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your new password."),
    password: z.string().min(8, "Password must be at least 8 characters."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordFields = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  // null = still checking; the /auth/callback route exchanges the recovery
  // code for a session before landing here, so this should resolve fast.
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitErrorRef = useFocusOnMount<HTMLParagraphElement>(submitError);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ResetPasswordFields>({
    defaultValues: { confirmPassword: "", password: "" },
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data.session);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function onSubmit(values: ResetPasswordFields) {
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setSubmitError("Could not reset your password. Request a new link and try again.");
      return;
    }

    router.push("/login?reset=success");
    router.refresh();
  }

  if (hasSession === null) return null;

  if (!hasSession) {
    return (
      <div className="space-y-4">
        <p className="border border-f1-red bg-f1-dark p-3 text-sm text-f1-silver" role="alert">
          This reset link is invalid or has expired.
        </p>
        <p className="text-center text-xs">
          <Link
            className="font-bold uppercase text-f1-red-text hover:text-white"
            href="/forgot-password"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {submitError ? (
        <p
          className="border border-f1-red bg-f1-dark p-3 text-sm text-f1-silver"
          ref={submitErrorRef}
          role="alert"
          tabIndex={-1}
        >
          {submitError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-f1-silver" htmlFor="reset-password">
          New password
        </Label>
        <Input
          aria-describedby={errors.password ? "reset-password-error" : undefined}
          aria-invalid={!!errors.password}
          autoComplete="new-password"
          className="h-11 border-f1-border bg-f1-dark text-f1-white placeholder:text-f1-muted focus-visible:border-f1-red"
          id="reset-password"
          type="password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-f1-red-text" id="reset-password-error">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-f1-silver" htmlFor="reset-confirm-password">
          Confirm new password
        </Label>
        <Input
          aria-describedby={
            errors.confirmPassword ? "reset-confirm-password-error" : undefined
          }
          aria-invalid={!!errors.confirmPassword}
          autoComplete="new-password"
          className="h-11 border-f1-border bg-f1-dark text-f1-white placeholder:text-f1-muted focus-visible:border-f1-red"
          id="reset-confirm-password"
          type="password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-f1-red-text" id="reset-confirm-password-error">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <button
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-f1-black disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        <span>{isSubmitting ? "Saving..." : "Reset password"}</span>
      </button>
    </form>
  );
}
