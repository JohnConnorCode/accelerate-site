import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { approveAndExecuteAction } from "@/lib/revenue-os/action-executor";
import { rejectAction, sweepExpiredActions } from "@/lib/revenue-os/actions";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  // Retire anything past its expiry before listing. Nothing else wrote the
  // `expired` status, so dead proposals stayed `pending` and kept their dedupe
  // key, permanently blocking the same action from ever being staged again.
  await sweepExpiredActions(supabase);
  const { data, error } = await supabase.from("action_queue").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ schemaReady: false, actions: [] });
    return NextResponse.json({ error: "Could not load actions" }, { status: 500 });
  }
  return NextResponse.json({ schemaReady: true, actions: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as { id?: string; decision?: "approve" | "reject"; reason?: string };
  if (!body.id || !["approve", "reject"].includes(body.decision || "")) return NextResponse.json({ error: "Action id and decision are required" }, { status: 400 });
  const supabase = createServiceRoleClient();
  try {
    if (body.decision === "reject") {
      await rejectAction(supabase, body.id, auth.user.email || "founder", body.reason);
      return NextResponse.json({ success: true });
    }
    const result = await approveAndExecuteAction(supabase, body.id, auth.user.email || "founder");
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not handle action" }, { status: 400 });
  }
}
