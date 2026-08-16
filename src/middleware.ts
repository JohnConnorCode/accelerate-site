import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isConfiguredAdmin } from "@/lib/admin/access";

export async function middleware(request: NextRequest) {
  // Only protect /admin routes (except login and password reset)
  if (
    !request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname === "/admin/login" ||
    request.nextUrl.pathname === "/admin/update-password"
  ) {
    return NextResponse.next();
  }

  const supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fail closed: redirect to login unless a logged-in user matches ADMIN_EMAIL
  // exactly (mirrors requireAdmin() on the /api/admin routes so the page gate
  // and the API gate agree).
  if (!user || !isConfiguredAdmin(user.email)) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
