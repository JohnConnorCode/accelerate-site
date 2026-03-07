import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 20, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;
  const supabase = createServiceRoleClient();

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
    await supabase
      .from("proposals")
      .update({
        viewed_at: new Date().toISOString(),
        status: proposal.status === "sent" ? "viewed" : proposal.status,
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
