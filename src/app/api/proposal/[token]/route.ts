import { NextRequest, NextResponse } from "next/server";
import { createBootstrapServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { TenantSystemContext } from "@/lib/tenancy/context";
import { rateLimit } from "@/lib/rate-limit";
import { transitionOpportunity, transitionStatusFromError } from "@/lib/revenue-os/pipeline";
import { recordActivity } from "@/lib/revenue-os/activities";
import { proposalAuditSummary, recordAudit } from "@/lib/revenue-os/audit";

export async function handleProposalGet(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
  tenantContext?: TenantSystemContext,
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(`proposal-view:${tenantContext?.tenantId || "accelerate"}:${ip}`, 20, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const supabase = tenantContext ? createServiceRoleClient(tenantContext) : createBootstrapServiceRoleClient("legacy-public-proposal");

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("share_token", token)
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // Track view if not already viewed
  if (!proposal.viewed_at && proposal.status !== "draft") {
    const nextStatus = proposal.status === "sent" ? "viewed" : proposal.status;
    await supabase
      .from("proposals")
      .update({
        viewed_at: new Date().toISOString(),
        status: nextStatus,
      })
      .eq("id", proposal.id);

    // Create notification for proposal view
    await supabase.from("admin_notifications").insert({
      type: "proposal_viewed",
      title: `Proposal viewed: ${proposal.title}`,
      description: `${proposal.client_name} viewed the proposal`,
      link: "/admin/proposals",
      read: false,
    });

    try {
      await recordAudit(supabase, {
        action: "proposal.viewed",
        entityType: "proposal",
        entityId: proposal.id,
        source: "public",
        before: proposalAuditSummary(proposal),
        after: proposalAuditSummary({ ...proposal, status: nextStatus }),
      });
    } catch (error) {
      console.error("Proposal view audit failed:", error instanceof Error ? error.message : "unknown");
    }
  }

  return NextResponse.json({
    proposal: {
      title: proposal.title,
      client_name: proposal.client_name,
      content: proposal.content,
      total_one_time: proposal.total_one_time,
      total_monthly: proposal.total_monthly,
      status: proposal.status,
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
  if (!rateLimit(`proposal-response:${tenantContext?.tenantId || "accelerate"}:${ip}`, 10, 60 * 60 * 1000).success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { token } = await params;
  const body = await request.json().catch(() => ({})) as { decision?: "accepted" | "declined"; reason?: string };
  if (!body.decision || !["accepted", "declined"].includes(body.decision)) return NextResponse.json({ error: "Choose accept or decline" }, { status: 400 });
  if (body.decision === "declined" && !body.reason?.trim()) return NextResponse.json({ error: "Please tell us why you are declining" }, { status: 400 });
  const supabase = tenantContext ? createServiceRoleClient(tenantContext) : createBootstrapServiceRoleClient("legacy-public-proposal");
  const { data: proposal, error } = await supabase.from("proposals").select("id,title,client_name,status,opportunity_id").eq("share_token", token).maybeSingle();
  if (error || !proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (["accepted", "declined"].includes(proposal.status)) return NextResponse.json({ success: true, status: proposal.status, alreadyResponded: true });
  if (!["sent", "viewed"].includes(proposal.status)) return NextResponse.json({ error: "This proposal is not open for a response" }, { status: 409 });
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase.from("proposals").update({ status: body.decision, responded_at: now, decline_reason: body.decision === "declined" ? body.reason!.trim().slice(0, 1000) : null }).eq("id", proposal.id).in("status", ["sent", "viewed"]).select("id,status").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Could not record the response" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "This proposal was already updated. Refresh the page." }, { status: 409 });
  await Promise.all([
    supabase.from("proposal_events").insert({ proposal_id: proposal.id, event_type: body.decision, source: "public_link", metadata: { reason: body.reason?.trim() || null } }),
    recordActivity(supabase, { activityType: `proposal_${body.decision}`, title: `${proposal.client_name} ${body.decision} ${proposal.title}`, summary: body.reason?.trim() || null, opportunityId: proposal.opportunity_id, proposalId: proposal.id, source: "public_link", externalId: `proposal:${proposal.id}:decision:${body.decision}`, occurredAt: now }),
    supabase.from("admin_notifications").insert({ type: "proposal_response", title: `Proposal ${body.decision}: ${proposal.title}`, description: body.reason?.trim() || `${proposal.client_name} ${body.decision} the proposal`, link: "/admin/proposals", read: false, priority: "urgent" }),
    supabase.from("tasks").insert({ title: `${body.decision === "accepted" ? "Start next steps with" : "Review decline from"} ${proposal.client_name}`, description: body.reason?.trim() || `Proposal ${body.decision}. Follow up personally.`, due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), priority: "high", opportunity_id: proposal.opportunity_id, related_type: "proposal", related_id: proposal.id, related_name: proposal.client_name, source: "proposal_response", dedupe_key: `proposal-response:${proposal.id}` }),
    recordAudit(supabase, {
      action: body.decision === "accepted" ? "proposal.accepted" : "proposal.declined",
      entityType: "proposal",
      entityId: proposal.id,
      source: "public",
      before: proposalAuditSummary(proposal),
      after: proposalAuditSummary({ ...proposal, status: body.decision }),
      metadata: { has_reason: Boolean(body.reason?.trim()) },
    }),
  ]);
  if (proposal.opportunity_id) {
    const nextStage = body.decision === "accepted" ? "negotiation" : "lost";
    const { data: opportunity } = await supabase.from("opportunities").select("stage").eq("id", proposal.opportunity_id).maybeSingle();
    if (opportunity && !["won", "lost"].includes(opportunity.stage)) {
      try {
        await transitionOpportunity(supabase, {
          id: proposal.opportunity_id,
          to: nextStage,
          actorEmail: "public_link",
          source: "proposal_response",
          reason: body.decision === "accepted" ? "Client accepted proposal" : "Client declined proposal",
          lossReason: body.decision === "declined" ? body.reason!.trim().slice(0, 1000) : undefined,
        });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Transition blocked by current stage" }, { status: transitionStatusFromError(error) });
      }
    }
  }
  return NextResponse.json({ success: true, status: body.decision });
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handleProposalGet(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handleProposalPost(request, context);
}
