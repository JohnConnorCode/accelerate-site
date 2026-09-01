import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The single writer for the `agent_runs` ledger.
 *
 * The engineering contract says there is one job ledger and one path to it.
 * Until now `agent_runs` had exactly one caller, the admin command agent, so a
 * second surface would have meant a second hand-rolled insert/update pair with
 * its own idea of what the terminal states are. This module exists so that the
 * public website chat, which talks to prospects with no human in the loop and
 * wrote no trace at all, joins the same ledger rather than starting another.
 *
 * Every function here is best-effort by design. Tracing must never be the
 * reason a prospect's chat reply fails, so a ledger write that fails is logged
 * and swallowed. That is the one place where swallowing is correct: the caller
 * has nothing useful to do with the error, and the alternative is losing the
 * real work to protect the record of it.
 */

/** Terminal states permitted by the agent_runs CHECK constraint. */
export type AgentRunOutcome = "completed" | "partial" | "failed" | "cancelled";

export interface AgentRunHandle {
  /** Null when the ledger write failed; every helper below then no-ops. */
  id: string | null;
  startedAt: number;
}

export async function startAgentRun(
  supabase: SupabaseClient,
  input: {
    surface: string;
    model: string;
    actorEmail?: string | null;
    promptPreview?: string;
    conversationId?: string | null;
    provider?: string;
    toolPack?: string;
  },
): Promise<AgentRunHandle> {
  const startedAt = Date.now();
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      surface: input.surface,
      actor_email: input.actorEmail ?? null,
      model: input.model,
      prompt_preview: input.promptPreview?.slice(0, 500) ?? null,
      ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.toolPack ? { tool_pack: input.toolPack } : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[agent-trace] could not open a run for ${input.surface}:`, error?.message);
    return { id: null, startedAt };
  }
  return { id: data.id as string, startedAt };
}

export async function finishAgentRun(
  supabase: SupabaseClient,
  run: AgentRunHandle,
  outcome: AgentRunOutcome,
  detail: {
    resultPreview?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    toolNames?: string[];
  } = {},
): Promise<void> {
  if (!run.id) return;
  const { error } = await supabase
    .from("agent_runs")
    .update({
      status: outcome,
      result_preview: detail.resultPreview?.slice(0, 1000) ?? null,
      error: detail.error?.slice(0, 1000) ?? null,
      input_tokens: detail.inputTokens ?? null,
      output_tokens: detail.outputTokens ?? null,
      ...(detail.toolNames ? { tool_names: [...new Set(detail.toolNames)] } : {}),
      duration_ms: Math.max(0, Date.now() - run.startedAt),
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  // A run left `running` never reaches a terminal state and reads as in-flight
  // forever, so a failure to close one is worth a log line even though there is
  // nothing the caller can do about it.
  if (error) console.error(`[agent-trace] could not close run ${run.id}:`, error.message);
}

export async function recordAgentRunEvent(
  supabase: SupabaseClient,
  run: AgentRunHandle,
  event: { eventType: string; toolName?: string; input?: unknown; output?: unknown },
): Promise<void> {
  if (!run.id) return;
  const { error } = await supabase.from("agent_run_events").insert({
    run_id: run.id,
    event_type: event.eventType,
    tool_name: event.toolName ?? null,
    input: event.input ?? null,
    output: event.output ?? null,
  });
  if (error)
    console.error(
      `[agent-trace] could not record ${event.eventType} on run ${run.id}:`,
      error.message,
    );
}

/**
 * Tee a streamed response into the ledger.
 *
 * The public chat streams tokens straight to the browser, so there is no point
 * at which the finished reply exists in one piece to record. Without this the
 * only fully autonomous AI we run talking to prospects would keep leaving no
 * trace of what it actually said. The transform passes every chunk through
 * untouched and closes the run when the stream ends, including when the client
 * disconnects mid-answer, which is itself worth knowing.
 */
export function traceTextStream(
  stream: ReadableStream<Uint8Array>,
  supabase: SupabaseClient,
  run: AgentRunHandle,
  completionDetail?: () => { inputTokens?: number; outputTokens?: number },
): ReadableStream<Uint8Array> {
  if (!run.id) return stream;

  const decoder = new TextDecoder();
  let text = "";
  let closed = false;

  const close = (outcome: AgentRunOutcome, error?: string) => {
    if (closed) return;
    closed = true;
    // Deliberately not awaited: the response has already been delivered, and
    // blocking the stream's flush on a database round-trip would add latency to
    // the reply for no benefit to the visitor.
    void finishAgentRun(supabase, run, outcome, {
      resultPreview: text,
      error,
      ...completionDetail?.(),
    });
  };

  // Written as an explicit reader loop rather than a TransformStream because
  // the transformer interface gives no hook for the consumer cancelling, and a
  // visitor closing the tab mid-answer is the case most likely to strand a run
  // in `running`.
  const reader = stream.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          close(
            text.trim() ? "completed" : "failed",
            text.trim() ? undefined : "Stream produced no content",
          );
          controller.close();
          return;
        }
        text += decoder.decode(value, { stream: true });
        controller.enqueue(value);
      } catch (error) {
        close("failed", error instanceof Error ? error.message : String(error));
        controller.error(error);
      }
    },
    cancel(reason) {
      close(
        "cancelled",
        `Client disconnected: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
      return reader.cancel(reason);
    },
  });
}
