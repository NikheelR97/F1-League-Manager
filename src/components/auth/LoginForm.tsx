"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDefaultPathForRole } from "@/lib/auth/redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface LoginFormProps {
  nextPath: string | null;
}

interface LoginErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const nextErrors: LoginErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setIsSubmitting(false);
      setSubmitError("Email or password is incorrect.");
      return;
    }

    let target = nextPath;
    if (!target) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      target = getDefaultPathForRole(profile?.role);
    }

    router.push(target);
    router.refresh();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {submitError ? (
        <p className="border border-f1-red bg-f1-dark p-3 text-sm text-f1-silver" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-f1-silver" htmlFor="login-email">
          Email
        </Label>
        <Input
          autoComplete="email"
          className="h-11 border-f1-border bg-f1-dark text-f1-white placeholder:text-f1-muted focus-visible:border-f1-red"
          id="login-email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
        {errors.email ? (
          <p className="text-xs text-f1-red">{errors.email}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-f1-silver" htmlFor="login-password">
          Password
        </Label>
        <Input
          autoComplete="current-password"
          className="h-11 border-f1-border bg-f1-dark text-f1-white placeholder:text-f1-muted focus-visible:border-f1-red"
          id="login-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
        {errors.password ? (
          <p className="text-xs text-f1-red">{errors.password}</p>
        ) : null}
      </div>

      <button
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-f1-red bg-f1-red px-4 py-2 text-sm font-bold uppercase text-white transition-colors hover:bg-white hover:text-f1-black focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-f1-black disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        <LogIn aria-hidden="true" size={18} strokeWidth={2.5} />
        <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>
      </button>

      <p className="text-center text-xs text-f1-muted">
        Need access? Ask your league admin to create your account.
      </p>
      <p className="text-center text-xs">
        <Link className="font-bold uppercase text-f1-red hover:text-white" href="/">
          Back to leagues
        </Link>
      </p>
    </form>
  );
}
