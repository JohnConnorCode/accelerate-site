import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { bookingMode } from "@/lib/booking";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length > 64) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const { data } = await createServiceRoleClient()
    .from("opportunities")
    .select("email, qualified, stage")
    .eq("qualifier_token", token)
    .maybeSingle();

  if (!data?.qualified) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    email: data.email,
    qualified: true,
    stage: data.stage,
    bookingMode: bookingMode() === "embed" ? "calendly" : "manual",
  });
}
