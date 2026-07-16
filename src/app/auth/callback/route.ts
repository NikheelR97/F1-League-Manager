import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  // getSafeNextPath only allows /admin* and /garage* paths, so a
  // next=/reset-password param always falls through to this default —
  // that's the intended behavior for the password-reset flow.
  const next = getSafeNextPath(request.nextUrl.searchParams.get("next")) ?? "/reset-password";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=reset-link", request.url));
}
