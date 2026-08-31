import { NextRequest, NextResponse } from "next/server";
import { handleProposalGet, handleProposalPost } from "@/app/api/proposal/[token]/route";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";

type RouteContext = { params: Promise<{ tenantSlug: string; token: string }> };

async function resolve(context: RouteContext) {
  const params = await context.params;
  const tenantContext = await resolveActiveTenantSystemContext(params.tenantSlug, "public-proposal");
  return { params, tenantContext };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { params, tenantContext } = await resolve(context);
  if (!tenantContext) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  return handleProposalGet(request, { params: Promise.resolve({ token: params.token }) }, tenantContext);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { params, tenantContext } = await resolve(context);
  if (!tenantContext) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  return handleProposalPost(request, { params: Promise.resolve({ token: params.token }) }, tenantContext);
}
