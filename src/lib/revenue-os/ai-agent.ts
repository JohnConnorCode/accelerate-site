import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenant } from "@/config/tenant";
import { getOpenRouterModel, openRouterChat, type OpenRouterMessage } from "@/lib/ai/openrouter";
import { loadAgentLearningSignals } from "./agent-learning";
import { AI_TOOL_REGISTRY_VERSION, executeRegisteredRevenueTool, toOpenRouterTools } from "./ai-tools";
import { finishAgentRun, recordAgentRunEvent, startAgentRun } from "./agent-trace";

/** Tool steps allowed before the run reports what it has and stops. */
const MAX_TOOL_TURNS = 5;
/** Ceiling on a single tool result inside the transcript. */
const MAX_TOOL_RESULT_CHARS = 6000;

/**
 * Tool results were pushed into the transcript whole and re-sent on every
 * subsequent turn, so one large result compounded across the entire run with
 * no token accounting anywhere. Truncating is visible to the model, which is
 * better than silently running out of context mid-answer.
 */
function boundedToolContent(output: unknown): string {
  const serialized = JSON.stringify(output);
  if (serialized.length <= MAX_TOOL_RESULT_CHARS) return serialized;
  return JSON.stringify({
    truncated: true,
    reason: `Result exceeded ${MAX_TOOL_RESULT_CHARS} characters and was cut. Narrow the request if you need more.`,
    preview: serialized.slice(0, MAX_TOOL_RESULT_CHARS),
  });
}

const SYSTEM_CONTRACT = `You are ${tenant.brand.name}'s founder-only Revenue OS copilot. Ground every factual claim in tool results. Never invent numbers, people, pricing, dates, or business facts. Read tools may run directly. Every write or outbound action must use a propose_* tool and clearly tell the founder it is awaiting approval. Prioritize revenue, replies, commitments, meetings, proposals, and campaign exceptions. ${tenant.ai.voice}`;

export interface CommandMessage { role: "user" | "assistant"; content: string }

export async function runRevenueCommandAgent(supabase: SupabaseClient, actorEmail: string, messages: CommandMessage[]) {
  const safeMessages = messages.slice(-12).filter((item) => ["user", "assistant"].includes(item.role) && item.content.trim()).map((item) => ({ role: item.role, content: item.content.slice(0, 8000) }));
  const lastMessage = safeMessages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") throw new Error("A user command is required");
  const model = getOpenRouterModel(process.env.OPENROUTER_AGENT_MODEL);
  const run = await startAgentRun(supabase, { surface: "admin_command", actorEmail, model, promptPreview: lastMessage.content });

  const transcript: OpenRouterMessage[] = safeMessages.map((message) => ({ role: message.role, content: message.content }));
  const toolNames: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const learningSignals = await loadAgentLearningSignals(supabase);
    // Without this the model reasons about "today" and "follow up in 3 days"
    // from its training cutoff. Everything this agent does is time-sensitive.
    const now = new Date();
    const today = `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" })} (${now.toISOString().slice(0, 10)}). Use this for every relative date; never infer the date from memory.`;
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const response = await openRouterChat({ model, maxTokens: 1200, messages: [{ role: "system", content: `${SYSTEM_CONTRACT}\n\n${today}\n\n${learningSignals}` }, ...transcript], tools: toOpenRouterTools() });
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;
      const assistant = response.choices[0]?.message;
      if (!assistant) throw new Error("OpenRouter returned no assistant response");
      transcript.push(assistant);
      await recordAgentRunEvent(supabase, run, { eventType: "model_response", output: { provider: "openrouter", request_id: response.id, model: response.model, usage: response.usage ?? {}, turn } });
      const uses = assistant.tool_calls ?? [];
      if (!uses.length) {
        const text = assistant.content?.trim() || "";
        await finishAgentRun(supabase, run, "completed", { toolNames, inputTokens, outputTokens, resultPreview: text });
        return { text, runId: run.id, proposedActions: toolNames.filter((name) => name.startsWith("propose_")) };
      }
      for (const use of uses) {
        const name = use.function.name;
        toolNames.push(name);
        let toolInput: Record<string, unknown> = {};
        try { toolInput = JSON.parse(use.function.arguments || "{}") as Record<string, unknown>; }
        catch { toolInput = {}; }
        try {
          const { output, tool } = await executeRegisteredRevenueTool({ supabase, actorEmail }, name, toolInput);
          await recordAgentRunEvent(supabase, run, { eventType: "tool_result", toolName: name, input: toolInput, output: { result: output, impact: tool.impact, confirmation_required: tool.confirmationRequired, registry_version: AI_TOOL_REGISTRY_VERSION } });
          transcript.push({ role: "tool", tool_call_id: use.id, content: boundedToolContent(output) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool failed";
          await recordAgentRunEvent(supabase, run, { eventType: "tool_error", toolName: name, input: toolInput, output: { error: message, registry_version: AI_TOOL_REGISTRY_VERSION } });
          transcript.push({ role: "tool", tool_call_id: use.id, content: JSON.stringify({ error: message }) });
        }
      }
    }
    // Turn exhaustion used to throw: the founder lost the whole answer, the run
    // was marked failed, and any propose_* actions staged on earlier turns
    // stayed in the queue as orphans with no conversation explaining them.
    // Return what was gathered and name the proposals instead.
    const staged = toolNames.filter((name) => name.startsWith("propose_"));
    const partial = [
      transcript.filter((entry) => entry.role === "assistant").map((entry) => entry.content?.trim()).filter(Boolean).join("\n\n"),
      `I stopped after ${MAX_TOOL_TURNS} tool steps without reaching a final answer. Ask me a narrower question and I will finish it.`,
      staged.length ? `Already staged for your approval: ${staged.join(", ")}. Review them in the approval queue, or reject them if this run went off track.` : "",
    ].filter(Boolean).join("\n\n");

    await finishAgentRun(supabase, run, "partial", { toolNames, inputTokens, outputTokens, resultPreview: partial, error: `Stopped after ${MAX_TOOL_TURNS} tool turns without a final answer` });
    return { text: partial, runId: run.id, proposedActions: staged };
  } catch (error) {
    await finishAgentRun(supabase, run, "failed", { toolNames, inputTokens, outputTokens, error: error instanceof Error ? error.message : "AI run failed" });
    throw error;
  }
}
