import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runRevenueCommandAgent, type CommandMessage } from "@/lib/revenue-os/ai-agent";
import { rateLimit } from "@/lib/rate-limit";

// Hobby functions default to a 10s ceiling. This route can make several model
// calls in sequence, so without this it is killed mid-run and leaves the ledger
// row `running` with no result. 60s is the Hobby maximum.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const key = auth.user.email || auth.user.id;
  if (!rateLimit(`revenue-os-ai:${key}`, 30, 60 * 60 * 1000).success) return NextResponse.json({ error: "AI command limit reached. Try again later." }, { status: 429 });
  const body = await request.json() as { messages?: CommandMessage[] };
  if (!Array.isArray(body.messages) || !body.messages.length) return NextResponse.json({ error: "Messages are required" }, { status: 400 });
  try {
    const result = await runRevenueCommandAgent(createServiceRoleClient(), auth.user.email || "founder", body.messages);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI command failed" }, { status: 400 });
  }
}
