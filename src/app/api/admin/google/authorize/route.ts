import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { buildGoogleAuthUrl } from "@/lib/revenue-os/google";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const state = randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(buildGoogleAuthUrl(state));
    response.cookies.set("google_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/setup?google_error=${encodeURIComponent(error instanceof Error ? error.message : "Google setup failed")}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }
}
