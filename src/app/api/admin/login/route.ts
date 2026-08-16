import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit } from "@/lib/rate-limit";
import { isConfiguredAdmin } from "@/lib/admin/access";

function requestKey(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `admin-login:${ip}`;
}

export async function POST(request: NextRequest) {
  const { success } = rateLimit(requestKey(request), 10, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let email: unknown;
  let password: unknown;
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid sign-in request." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password ||
    email.length > 254 ||
    password.length > 500
  ) {
    return NextResponse.json(
      { error: "Enter your admin email and password." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let response: NextResponse = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );

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

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: "The email or password is incorrect." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!isConfiguredAdmin(data.user.email)) {
    response = NextResponse.json(
      { error: "This account does not have admin access." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
    await supabase.auth.signOut();
    return response;
  }

  return response;
}
