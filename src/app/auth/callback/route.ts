import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next");

  let safeNext = "/admin";

  // For password recovery, redirect to update password page
  if (type === "recovery") {
    safeNext = "/admin/update-password";
  } else if (rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")) {
    safeNext = rawNext;
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
      return response;
    }
  }

  // If code exchange failed, redirect to login with error
  return NextResponse.redirect(new URL("/admin/login?error=reset_failed", origin));
}
