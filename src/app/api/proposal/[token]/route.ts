import { NextRequest, NextResponse } from "next/server";
import { createBootstrapServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { TenantSystemContext } from "@/lib/tenancy/context";
import { rateLimit } from "@/lib/rate-limit";
import { transitionStatusFromError } from "@/lib/revenue-os/pipeline";
import { decideProposal, recordProposalView } from "@/lib/revenue-os/proposals";

export async function handleProposalGet(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
  tenantContext?: TenantSystemContext,
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(
    `proposal-view:${tenantContext?.tenantId || "accelerate"}:${ip}`,
    20,
    60 * 60 * 1000,
  );
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const supabase = tenantContext
    ? createServiceRoleClient(tenantContext)
    : createBootstrapServiceRoleClient("legacy-public-proposal");

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  let status = proposal.status;
  try {
    const viewed = await recordProposalView(supabase, { id: proposal.id, source: "public_link" });
    status = viewed.proposal.status;
    if (!viewed.alreadyViewed) {
      await supabase.from("admin_notifications").insert({
        type: "proposal_viewed",
        title: `Proposal viewed: ${proposal.title}`,
        description: `${proposal.client_name} viewed the proposal`,
        link: "/admin/proposals",
        read: false,
      });
    }
  } catch (error) {
    console.error(
      "Proposal view tracking failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  return NextResponse.json({
    proposal: {
      title: proposal.title,
      client_name: proposal.client_name,
      content: proposal.content,
      total_one_time: proposal.total_one_time,
      total_monthly: proposal.total_monthly,
      status,
      created_at: proposal.created_at,
    },
  });
}

export async function handleProposalPost(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
  tenantContext?: TenantSystemContext,
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (
    !rateLimit(
      `proposal-response:${tenantContext?.tenantId || "accelerate"}:${ip}`,
      10,
      60 * 60 * 1000,
    ).success
  )
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    decision?: "accepted" | "declined";
    reason?: string;
  };
  if (!body.decision || !["accepted", "declined"].includes(body.decision))
    return NextResponse.json({ error: "Choose accept or decline" }, { status: 400 });
  if (body.decision === "declined" && !body.reason?.trim())
    return NextResponse.json({ error: "Please tell us why you are declining" }, { status: 400 });
  const supabase = tenantContext
    ? createServiceRoleClient(tenantContext)
    : createBootstrapServiceRoleClient("legacy-public-proposal");
  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("id,title,client_name,status,opportunity_id")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !proposal)
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  try {
    const decided = await decideProposal(supabase, {
      id: proposal.id,
      decision: body.decision,
      reason: body.reason,
      actorEmail: "public_link",
      source: "public_link",
    });
    if (!decided.alreadyResponded) {
      await supabase.from("admin_notifications").insert({
        type: "proposal_response",
        title: `Proposal ${body.decision}: ${proposal.title}`,
        description: body.reason?.trim() || `${proposal.client_name} ${body.decision} the proposal`,
        link: "/admin/proposals",
        read: false,
        priority: "urgent",
      });
    }
    return NextResponse.json({
      success: true,
      status: decided.proposal.status,
      alreadyResponded: decided.alreadyResponded,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record the response";
    if (/no longer open|already updated|expired/i.test(message))
      return NextResponse.json({ error: message }, { status: 409 });
    if (/decline reason|cannot move/i.test(message))
      return NextResponse.json({ error: message }, { status: 400 });
    if (/Transition blocked|loss reason|unknown stage/i.test(message))
      return NextResponse.json({ error: message }, { status: transitionStatusFromError(error) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handleProposalGet(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handleProposalPost(request, context);
}
