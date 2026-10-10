import { NextRequest, NextResponse } from "next/server";
import { isSupabasePublicConfigured } from "@/lib/supabase/configuration.mjs";
import { createServerClient } from "@supabase/ssr";
import { activateInvitedTenantMembership } from "@/lib/tenancy/lifecycle";
import { commandCenterOrigin } from "@/lib/command-center/runtime";

function validTenantId(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function validTenantSlug(value: string | null): value is string {
  return Boolean(value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
}

function safeRedirect(value: string | null, fallback: string) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
    ? value
    : fallback;
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin =
    commandCenterOrigin || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const tenantId = searchParams.get("tenant_id");
  const workspace = searchParams.get("workspace");
  const rawNext = searchParams.get("next");

  const safeNext = safeRedirect(
    rawNext,
    type === "recovery" ? "/admin/update-password" : "/workspace",
  );

  const error =
    type === "recovery" || safeNext === "/admin/update-password" ? "reset_failed" : "auth_failed";
  const failure = NextResponse.redirect(new URL(`/admin/login?error=${error}`, origin));
  failure.headers.set("Cache-Control", "private, no-store");
  if (
    !isSupabasePublicConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  ) {
    const response = NextResponse.redirect(new URL("/admin/login?error=not_configured", origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const invitation =
    tokenHash &&
    (type === "invite" || type === "magiclink") &&
    validTenantId(tenantId) &&
    validTenantSlug(workspace);
  const recovery = tokenHash && type === "recovery";
  if (!code && !recovery && !invitation) return failure;

  const response = NextResponse.redirect(
    new URL(invitation && !code ? `/t/${workspace}/admin/today` : safeNext, origin),
  );
  response.headers.set("Cache-Control", "private, no-store");
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
        },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            for (const { name, value, options } of cookies)
              response.cookies.set(name, value, options);
          },
        },
      },
    );

    // PKCE callbacks may omit type=recovery; next retains the intended page.
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return response;
    } else if (recovery) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "recovery" });
      if (!error) return response;
    } else if (invitation) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type as "invite" | "magiclink",
      });
      if (error) {
        failure.headers.set("Location", new URL("/admin/login?error=invite_failed", origin).href);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) {
          await activateInvitedTenantMembership({
            tenantId: tenantId!,
            tenantSlug: workspace!,
            userId: user.id,
            email: user.email,
          });
          return response;
        }
        failure.headers.set("Location", new URL("/admin/login?error=invite_failed", origin).href);
      }
    }
  } catch {
    // Provider details, codes and tokens do not belong in the redirect or logs.
    if (invitation && !code)
      failure.headers.set(
        "Location",
        new URL("/admin/login?error=invite_unavailable", origin).href,
      );
  }
  // Failed PKCE exchanges can clear verifier cookies. Preserve those changes
  // on the failure redirect so a fresh recovery request starts cleanly.
  return copyResponseCookies(response, failure);
}
