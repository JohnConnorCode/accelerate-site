import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAgentFeedback, type AgentFeedbackRating } from "@/lib/revenue-os/agent-learning";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as { runId?: string; rating?: AgentFeedbackRating };
  if (!body.runId || !["helpful", "not_helpful"].includes(body.rating || "")) {
    return NextResponse.json({ error: "A completed run and feedback rating are required" }, { status: 400 });
  }
  try {
    await recordAgentFeedback(auth.database, { runId: body.runId, rating: body.rating as AgentFeedbackRating, actorEmail: auth.user.email || "founder" });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record feedback" }, { status: 400 });
  }
}
