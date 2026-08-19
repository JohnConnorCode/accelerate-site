import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  const { data: runs, error } = await supabase.from("agent_runs").select("id,surface,model,status,tool_names,input_tokens,output_tokens,result_preview,error,started_at,finished_at").order("started_at", { ascending: false }).limit(50);
  if (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ schemaReady: false, runs: [], feedback: { helpful: 0, notHelpful: 0 } });
    return NextResponse.json({ error: "Could not load AI operations" }, { status: 500 });
  }
  const ids = (runs ?? []).map((run) => run.id);
  const { data: feedback } = ids.length ? await supabase.from("agent_run_events").select("run_id,output").eq("event_type", "human_feedback").in("run_id", ids) : { data: [] };
  const byRun = new Map((feedback ?? []).map((event) => [event.run_id, (event.output as { rating?: string } | null)?.rating ?? null]));
  const helpful = [...byRun.values()].filter((rating) => rating === "helpful").length;
  const notHelpful = [...byRun.values()].filter((rating) => rating === "not_helpful").length;
  return NextResponse.json({ schemaReady: true, runs: (runs ?? []).map((run) => ({ ...run, feedback: byRun.get(run.id) ?? null })), feedback: { helpful, notHelpful } });
}
