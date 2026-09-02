import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isConfiguredAdmin } from "@/lib/admin/access";
import { isDemoScenarioId } from "@/lib/admin/demo/scenarios";
import { ACCELERATE_TENANT_ID, ACCELERATE_TENANT_SLUG } from "@/lib/tenancy/constants";

export async function middleware(request: NextRequest) {
  // Keep the legacy preview URL as a real redirect. A server-component
  // permanentRedirect can be represented as a meta refresh during a direct
  // document request, which leaves browser history and analytics on the old
  // URL. The middleware redirect is unambiguous for both document and RSC
  // requests while the route-level redirect remains the canonical fallback.
  if (request.nextUrl.pathname === "/command-center/demo") {
    return NextResponse.redirect(new URL("/demo/command-center", request.url), 308);
  }

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
    requestHeaders.set(
      "x-accelerate-demo-route",
      request.nextUrl.pathname.replace(/^\/admin\/?/, "") || "today",
    );
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  const workspaceMatch = request.nextUrl.pathname.match(
    /^\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)\/admin(?:\/(.*))?$/,
  );

  // Only protect canonical tenant workspaces and legacy Accelerate admin routes.
  if (
    (!request.nextUrl.pathname.startsWith("/admin") && !workspaceMatch) ||
    request.nextUrl.pathname === "/admin/login" ||
    request.nextUrl.pathname === "/admin/update-password"
  ) {
    return NextResponse.next();
  }

  // A freshly deployed instance with no Supabase project connected yet must
  // not crash here: createServerClient throws on a missing/invalid URL, which
  // previously surfaced as a raw 500 on every /admin request. Send it to the
  // login page's own "not configured" state instead, which needs no Supabase
  // client to render. This never fires once NEXT_PUBLIC_SUPABASE_URL and
  // NEXT_PUBLIC_SUPABASE_ANON_KEY are set, so a configured deployment is
  // unaffected.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const notConfiguredUrl = new URL("/admin/login", request.url);
    notConfiguredUrl.searchParams.set("error", "not_configured");
    return NextResponse.redirect(notConfiguredUrl);
  }

  const requestHeaders = new Headers(request.headers);
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

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
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  let tenantId = ACCELERATE_TENANT_ID;
  let tenantSlug = ACCELERATE_TENANT_SLUG;
  let tenantName = "Accelerate";

  if (workspaceMatch) {
    tenantSlug = workspaceMatch[1]!;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id,slug,name,status")
      .eq("slug", tenantSlug)
      .maybeSingle();
    if (!tenant || tenant.status !== "active") {
      const forbiddenUrl = new URL("/admin/login", request.url);
      forbiddenUrl.searchParams.set("error", "workspace_access");
      return NextResponse.redirect(forbiddenUrl);
    }
    tenantId = tenant.id;
    tenantName = tenant.name;
    const workspaceRoute = workspaceMatch[2] || "today";
    if (
      !isConfiguredAdmin(user.email) &&
      /^(features|tenants|setup)(?:\/|$)/.test(workspaceRoute)
    ) {
      return NextResponse.redirect(new URL(`/t/${tenantSlug}/admin/today`, request.url));
    }

    const destination = request.nextUrl.clone();
    destination.pathname = `/admin/${workspaceRoute}`;
    requestHeaders.set("x-tenant-workspace", "true");
    supabaseResponse = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  } else if (!isConfiguredAdmin(user.email)) {
    const forbiddenUrl = new URL("/admin/login", request.url);
    forbiddenUrl.searchParams.set("error", "workspace_required");
    return NextResponse.redirect(forbiddenUrl);
  }

  requestHeaders.set("x-tenant-id", tenantId);
  requestHeaders.set("x-tenant-slug", tenantSlug);
  requestHeaders.set("x-tenant-name", tenantName);
  requestHeaders.set("x-platform-admin", isConfiguredAdmin(user.email) ? "true" : "false");
  // Recreate the response after context headers are complete.
  const refreshedAuthCookies = supabaseResponse.cookies.getAll();
  if (workspaceMatch) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/admin/${workspaceMatch[2] || "today"}`;
    supabaseResponse = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  } else {
    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
  }
  refreshedAuthCookies.forEach((cookie) => supabaseResponse.cookies.set(cookie));
  supabaseResponse.cookies.set("accelerate-tenant-slug", tenantSlug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/t/:path*", "/demo/command-center/:path*", "/command-center/demo"],
};
