import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
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
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await createPlatformServiceRoleClient("tenant-invitation-activation")
          .from("tenant_memberships")
          .update({ status: "active", activated_at: new Date().toISOString(), revoked_at: null })
          .eq("user_id", user.id)
          .eq("invited_email", user.email.toLowerCase())
          .eq("status", "invited");
      }
      return response;
    }
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

  // If code exchange failed, redirect to login with error
  return NextResponse.redirect(new URL("/admin/login?error=reset_failed", origin));
}
