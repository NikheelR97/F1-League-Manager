import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/redirects";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookieToSet of cookiesToSet) {
            request.cookies.set(cookieToSet.name, cookieToSet.value);
          }

          response = NextResponse.next({ request });

          for (const cookieToSet of cookiesToSet) {
            response.cookies.set(
              cookieToSet.name,
              cookieToSet.value,
              cookieToSet.options,
            );
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return response;

  const nextPath = getSafeNextPath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";

  if (nextPath) {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/garage/:path*"],
};
