"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className={cn(
        "mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 border border-f1-border bg-transparent px-3 py-2 text-xs font-bold uppercase text-f1-silver transition-colors hover:border-f1-red hover:text-white focus:outline-none focus:ring-2 focus:ring-f1-red disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      disabled={isSigningOut}
      onClick={handleSignOut}
      type="button"
    >
      <LogOut aria-hidden="true" size={14} strokeWidth={2.5} />
      <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}
