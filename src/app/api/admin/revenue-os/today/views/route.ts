import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { readTodayViewProposal, readTodayViews, saveTodayViews } from "@/lib/revenue-os/today-views";
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const digest = new URL(request.url).searchParams.get("proposal");
    return NextResponse.json(await runWithTenantRequestContext(auth, () => digest ? readTodayViewProposal(auth.database, digest) : readTodayViews(auth.database)));
  }
  catch (error) {
    console.error("[revenue-os/today/views]", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Saved views are unavailable. Retry to recover your layout." }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    return NextResponse.json(await runWithTenantRequestContext(auth, () => saveTodayViews(auth.database, body)));
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "The view could not be saved.";
    return NextResponse.json({ error: message }, { status: message.includes("another session") ? 409 : 400 });
  }
}
