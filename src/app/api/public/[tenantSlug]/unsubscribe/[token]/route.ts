import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/app/api/unsubscribe/[token]/route";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";

type RouteContext = { params: Promise<{ tenantSlug: string; token: string }> };

async function handle(context: RouteContext) {
  const params = await context.params;
  const tenantContext = await resolveActiveTenantSystemContext(params.tenantSlug, "public-unsubscribe");
  if (!tenantContext) return NextResponse.json({ success: true });
  return unsubscribe({ params: Promise.resolve({ token: params.token }) }, tenantContext);
}

export async function POST(_request: NextRequest, context: RouteContext) {
  return handle(context);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  await handle(context);
  return new NextResponse("You have been unsubscribed from campaign email. You may close this page.", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
