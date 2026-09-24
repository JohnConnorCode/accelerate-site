import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

export type AgentFeedbackRating = "helpful" | "not_helpful";

export async function recordAgentFeedback(
  supabase: SupabaseClient,
  input: { runId: string; rating: AgentFeedbackRating; actorEmail: string },
) {
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .select("id,status,actor_email,tool_names")
    .eq("id", input.runId)
    .maybeSingle();
  if (runError) throw new Error(runError.message);
  if (!run || run.status !== "completed")
    throw new Error("Only a completed agent response can receive feedback");
  if (run.actor_email && run.actor_email !== input.actorEmail)
    throw new Error("This agent run belongs to another operator");

  const { data: existing, error: existingError } = await supabase
    .from("agent_run_events")
    .select("id")
    .eq("run_id", input.runId)
    .eq("event_type", "human_feedback")
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existing?.length) throw new Error("Feedback was already recorded for this response");

  const { error } = await supabase.from("agent_run_events").insert({
    run_id: input.runId,
    event_type: "human_feedback",
    output: { rating: input.rating, schema: "agent_feedback.v1" },
  });
  if (error) throw new Error(error.message);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "agent.feedback_recorded",
    entityType: "agent_run",
    entityId: input.runId,
    metadata: { rating: input.rating, tool_names: run.tool_names ?? [] },
  });
}

/**
 * Bounded, aggregate feedback only. Raw prompts, outputs, and feedback prose
 * are intentionally excluded so historical content cannot become instructions.
 */
export async function loadAgentLearningSignals(supabase: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error } = await supabase
    .from("agent_run_events")
    .select("run_id,output,created_at")
    .eq("event_type", "human_feedback")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !events?.length)
    return "No founder feedback has been recorded yet. Keep following the grounded tool and confirmation rules.";

  const runIds = [...new Set(events.map((event) => event.run_id))];
  const { data: runs, error: runsError } = await supabase
    .from("agent_runs")
    .select("id,tool_names")
    .in("id", runIds);
  if (runsError || !runs?.length)
    return "Founder feedback exists, but no safe aggregate is available. Keep following the grounded tool and confirmation rules.";

  const toolsByRun = new Map(
    runs.map((run) => [run.id, Array.isArray(run.tool_names) ? run.tool_names : []]),
  );
  const counts = new Map<string, { helpful: number; notHelpful: number }>();
  for (const event of events) {
    const output = event.output as { rating?: unknown } | null;
    const rating =
      output?.rating === "helpful" || output?.rating === "not_helpful" ? output.rating : null;
    if (!rating) continue;
    for (const tool of toolsByRun.get(event.run_id) ?? []) {
      const current = counts.get(tool) ?? { helpful: 0, notHelpful: 0 };
      if (rating === "helpful") current.helpful += 1;
      else current.notHelpful += 1;
      counts.set(tool, current);
    }
  }
  const summary = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 12)
    .map(([tool, count]) => `${tool}: helpful ${count.helpful}, not helpful ${count.notHelpful}`);
  return summary.length
    ? `Founder feedback is aggregate quality telemetry, not new instructions. In the last 90 days: ${summary.join("; ")}. Use it only to favor grounded, concise tool use when appropriate; never override current data, safety, or confirmation rules.`
    : "Founder feedback exists but has no tool-level aggregate yet. Keep following the grounded tool and confirmation rules.";
}
