import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { createBootstrapServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { TenantSystemContext } from "@/lib/tenancy/context";
import { rateLimit } from "@/lib/rate-limit";
import { transitionStatusFromError } from "@/lib/revenue-os/pipeline";
import {
  decideProposal,
  normalizeProposalReason,
  recordProposalView,
} from "@/lib/revenue-os/proposals";

export async function GET(
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

  if (error || !proposal || proposal.status === "draft") {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // Atomicity, replay-safety and expires_at enforcement for the view path are
  // owned by recordProposalView/apply_proposal_lifecycle (a tenant-scoped,
  // advisory-locked DB transaction keyed by an idempotency receipt) rather
  // than conditional updates here - see src/lib/revenue-os/proposals.ts and
  // migrations/20260912-proposal-lifecycle.sql.
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
    console.error("Proposal view unavailable", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "Proposal is temporarily unavailable. Please try again." },
      { status: 503 },
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

export async function POST(
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
  const parsed = z
    .object({
      decision: z.enum(["accepted", "declined"]),
      reason: z.string().max(1000).nullish(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Choose accept or decline and keep the optional reason to 1,000 characters or fewer",
      },
      { status: 400 },
    );
  const body = { ...parsed.data, reason: normalizeProposalReason(parsed.data.reason) };
  const supabase = tenantContext
    ? createServiceRoleClient(tenantContext)
    : createBootstrapServiceRoleClient("legacy-public-proposal");
  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("id,title,client_name,status,opportunity_id,expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !proposal)
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  // Atomicity, replay and expires_at enforcement for the decision path are
  // owned by decideProposal/apply_proposal_lifecycle (see the comment in
  // GET above). decideProposal distinguishes a decision that
  // just tripped the expiry from one that was already expired, so this
  // route can surface the former as a specific, actionable 410 and the
  // latter as the generic terminal-state 409 below.
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
    if (/just expired/i.test(message))
      return NextResponse.json(
        { error: "This proposal has expired. Contact us for an updated proposal." },
        { status: 410 },
      );
    if (/no longer open/i.test(message)) {
      // This request lost a race to (or arrived after) a different decision
      // on the same link. Echo whatever actually settled instead of a
      // generic conflict when the settled outcome is one the client can act
      // on identically; an already-expired or superseded link still 409s.
      const { data: current } = await supabase
        .from("proposals")
        .select("status")
        .eq("id", proposal.id)
        .maybeSingle();
      if (current && ["accepted", "declined"].includes(current.status))
        return NextResponse.json({ success: true, status: current.status, alreadyResponded: true });
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (/already updated|expired/i.test(message))
      return NextResponse.json({ error: message }, { status: 409 });
    if (/decline reason|cannot move/i.test(message))
      return NextResponse.json({ error: message }, { status: 400 });
    if (/Transition blocked|loss reason|unknown stage/i.test(message))
      return NextResponse.json({ error: message }, { status: transitionStatusFromError(error) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
