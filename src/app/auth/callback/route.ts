import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { activateInvitedTenantMembership } from "@/lib/tenancy/lifecycle";

function validTenantId(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function validTenantSlug(value: string | null): value is string {
  return Boolean(value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const tenantId = searchParams.get("tenant_id");
  const workspace = searchParams.get("workspace");
  const rawNext = searchParams.get("next");

  let safeNext = "/admin";

  // `type=recovery` is not consistently retained when Supabase exchanges a
  // PKCE code. Preserve the intended destination in the allowed callback URL
  // instead, with `type` retained as a compatibility fallback for older links.
  if (rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")) {
    safeNext = rawNext;
  } else if (type === "recovery") {
    safeNext = "/admin/update-password";
  }

  if (code) {
    const response = NextResponse.redirect(new URL(safeNext, origin));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  if (tokenHash && type === "recovery") {
    const response = NextResponse.redirect(new URL(safeNext, origin));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (!error) return response;
  }

  if (tokenHash && (type === "invite" || type === "magiclink") && validTenantId(tenantId) && validTenantSlug(workspace)) {
    const response = NextResponse.redirect(new URL(`/t/${workspace}/admin/today`, origin));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          },
        },
      },
    );
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        try {
          await activateInvitedTenantMembership({ tenantId, tenantSlug: workspace, userId: user.id, email: user.email });
          return response;
        } catch {
          return copyResponseCookies(response, NextResponse.redirect(new URL("/admin/login?error=invite_unavailable", origin)));
        }
      }
    }
    return copyResponseCookies(response, NextResponse.redirect(new URL("/admin/login?error=invite_failed", origin)));
  }

  // If code exchange failed, redirect to login with error
  return NextResponse.redirect(new URL("/admin/login?error=reset_failed", origin));
}
