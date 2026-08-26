import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isConfiguredAdmin } from "@/lib/admin/access";
import { isDemoScenarioId } from "@/lib/admin/demo/scenarios";

export async function middleware(request: NextRequest) {
  const demoMatch = request.nextUrl.pathname.match(
    /^\/demo\/command-center\/([a-z0-9-]+)(?:\/(.*))?$/,
  );
  if (demoMatch) {
    const scenario = demoMatch[1]!;
    if (!isDemoScenarioId(scenario)) {
      return NextResponse.redirect(new URL("/demo/command-center", request.url));
    }
    const requestedRoute = demoMatch[2];
    const destination = request.nextUrl.clone();
    destination.pathname = `/admin/${requestedRoute || "today"}`;
    destination.searchParams.set("__demoScenario", scenario);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-accelerate-admin-runtime", "demo");
    requestHeaders.set("x-accelerate-demo-scenario", scenario);
    requestHeaders.set("x-accelerate-demo-route", requestedRoute || "today");
    const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  // Next 16 can re-enter middleware for the internal rewrite target. Preserve
  // the validated fictional runtime on that second pass so it never falls
  // through to live-admin authorization. The marker can only select one of
  // the checked-in demo packs; it does not grant access to live APIs or data.
  const rewrittenDemoScenario = request.nextUrl.searchParams.get("__demoScenario") || "";
  if (request.nextUrl.pathname.startsWith("/admin") && isDemoScenarioId(rewrittenDemoScenario)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-accelerate-admin-runtime", "demo");
    requestHeaders.set("x-accelerate-demo-scenario", rewrittenDemoScenario);
    requestHeaders.set("x-accelerate-demo-route", request.nextUrl.pathname.replace(/^\/admin\/?/, "") || "today");
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

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
  matcher: ["/admin/:path*", "/demo/command-center/:path*"],
};
