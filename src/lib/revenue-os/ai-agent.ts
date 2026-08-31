import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenant } from "@/config/tenant";
import { getOpenRouterModel, openRouterChat, openRouterChatStream, OpenRouterError, type OpenRouterMessage } from "@/lib/ai/openrouter";
import { loadAgentLearningSignals } from "./agent-learning";
import { AI_TOOL_REGISTRY_VERSION, executeRegisteredRevenueTool, selectRevenueToolPack, toOpenRouterTools, type RevenueToolPackId } from "./ai-tools";
import { finishAgentRun, recordAgentRunEvent, startAgentRun } from "./agent-trace";
import { AI_CONTEXT_VERSION, boundFounderConversation, boundToolResult, buildRevenueAiGroundingContract, groundedAnswerFailure, validateGroundedRevenueAnswer } from "./ai-context";

/** Tool steps allowed before the run reports what it has and stops. */
const MAX_TOOL_TURNS = 5;
const SYSTEM_CONTRACT = `You are ${tenant.brand.name}'s founder-only Revenue OS copilot. Ground every factual claim in tool results. Never invent numbers, people, pricing, dates, or business facts. Read tools may run directly. Every write or outbound action must use a propose_* tool and clearly tell the founder it is awaiting approval. Prioritize revenue, replies, commitments, meetings, proposals, and campaign exceptions. ${tenant.ai.voice}`;

export interface CommandMessage { role: "user" | "assistant"; content: string }
export interface CommandPageContext { pathname: string; entity?: { type: "opportunity" | "contact" | "company"; id: string } }
export interface AgentProposalSummary { id: string; actionType: string; title: string; impact: string; entityType: string | null; entityId: string | null }
export interface CommandAgentOptions {
  surface?: string;
  conversationId?: string | null;
  pageContext?: CommandPageContext | null;
  signal?: AbortSignal;
  onRunStarted?: (event: { runId: string | null; model: string; pack: RevenueToolPackId }) => void;
  onAssistantDelta?: (delta: string) => void;
  onToolStarted?: (event: { name: string; index: number }) => void;
  onToolCompleted?: (event: { name: string; index: number; summary: string; failed: boolean }) => void;
  onProposalStaged?: (proposal: AgentProposalSummary) => void;
}

function safePageContext(context: CommandPageContext | null | undefined): string {
  if (!context?.pathname.startsWith("/admin")) return "";
  const pathname = context.pathname.slice(0, 240);
  if (!context.entity) return `The founder opened this assistant from ${pathname}. Use that only as navigation context.`;
  const id = context.entity.id.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return `The founder opened this assistant from ${pathname}.`;
  return `The founder opened this assistant from ${pathname}, focused on canonical ${context.entity.type} ${id}. Use registered read tools to verify every record fact before answering.`;
}

function traceValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[bounded]";
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 180)}… [${value.length} chars]` : value;
  if (Array.isArray(value)) return value.slice(0, 5).map((item) => traceValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (/secret|token|credential|authorization/i.test(key)) result[key] = "[redacted]";
    else result[key] = traceValue(item, depth + 1);
  }
  return result;
}

function toolSummary(output: unknown): string {
  if (Array.isArray(output)) return `${output.length} result${output.length === 1 ? "" : "s"}`;
  if (!output || typeof output !== "object") return String(output ?? "No result").slice(0, 180);
  const row = output as Record<string, unknown>;
  if (typeof row.action_type === "string") return `Staged ${row.action_type.replace(/_/g, " ")} for approval`;
  if (Array.isArray(row.activities)) return `${row.activities.length} timeline event${row.activities.length === 1 ? "" : "s"}`;
  const counts = Object.entries(row).filter(([, value]) => typeof value === "number").slice(0, 3).map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${value}`);
  return counts.join(" · ") || "Completed with bounded evidence";
}

function proposalSummary(output: unknown, impact: string): AgentProposalSummary | null {
  if (!output || typeof output !== "object") return null;
  const row = output as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.action_type !== "string") return null;
  return {
    id: row.id,
    actionType: row.action_type,
    title: typeof row.title === "string" ? row.title : row.action_type.replace(/_/g, " "),
    impact,
    entityType: typeof row.entity_type === "string" ? row.entity_type : null,
    entityId: typeof row.entity_id === "string" ? row.entity_id : null,
  };
}

export async function runRevenueCommandAgent(supabase: SupabaseClient, actorEmail: string, messages: CommandMessage[], options: CommandAgentOptions = {}) {
  const safeMessages = boundFounderConversation(messages);
  const lastMessage = safeMessages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") throw new Error("A user command is required");
  const model = getOpenRouterModel(process.env.OPENROUTER_AGENT_MODEL);
  const selectedPack = options.pageContext?.entity?.type === "opportunity" ? "pipeline" : selectRevenueToolPack(lastMessage.content);
  const run = await startAgentRun(supabase, { surface: options.surface ?? "admin_command", actorEmail, model, promptPreview: lastMessage.content, conversationId: options.conversationId, provider: "openrouter", toolPack: selectedPack });
  options.onRunStarted?.({ runId: run.id, model, pack: selectedPack });

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
      const context = safePageContext(options.pageContext);
      const grounding = buildRevenueAiGroundingContract({ today, learningSignals, pageContext: context, toolPack: selectedPack });
      const request = { model, maxTokens: 1200, signal: options.signal, messages: [{ role: "system" as const, content: `${SYSTEM_CONTRACT}\n\n${grounding}` }, ...transcript], tools: toOpenRouterTools(selectedPack) };
      let bufferedAnswer = "";
      const response = options.onAssistantDelta
        ? await openRouterChatStream(request, (delta) => { bufferedAnswer += delta; })
        : await openRouterChat(request);
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;
      const assistant = response.choices[0]?.message;
      if (!assistant) throw new Error("OpenRouter returned no assistant response");
      transcript.push(assistant);
      await recordAgentRunEvent(supabase, run, { eventType: "model_response", output: { provider: "openrouter", request_id: response.id, model: response.model, usage: response.usage ?? {}, turn, context_version: AI_CONTEXT_VERSION } });
      const uses = assistant.tool_calls ?? [];
      if (!uses.length) {
        const text = assistant.content?.trim() || "";
        const grounding = validateGroundedRevenueAnswer(text, toolNames);
        if (!grounding.valid) {
          const safeAnswer = groundedAnswerFailure(grounding.reason || "The answer could not be verified");
          options.onAssistantDelta?.(safeAnswer);
          await finishAgentRun(supabase, run, "partial", { toolNames, inputTokens, outputTokens, resultPreview: safeAnswer, error: grounding.reason || "Grounding contract rejected the answer" });
          return { text: safeAnswer, runId: run.id, proposedActions: toolNames.filter((name) => name.startsWith("propose_")) };
        }
        if (options.onAssistantDelta) options.onAssistantDelta(bufferedAnswer || text);
        await finishAgentRun(supabase, run, "completed", { toolNames, inputTokens, outputTokens, resultPreview: text });
        return { text, runId: run.id, proposedActions: toolNames.filter((name) => name.startsWith("propose_")) };
      }
      for (const use of uses) {
        const name = use.function.name;
        const toolIndex = toolNames.length;
        toolNames.push(name);
        options.onToolStarted?.({ name, index: toolIndex });
        let toolInput: Record<string, unknown> = {};
        try { toolInput = JSON.parse(use.function.arguments || "{}") as Record<string, unknown>; }
        catch { toolInput = {}; }
        try {
          const { output, tool } = await executeRegisteredRevenueTool({ supabase, actorEmail, toolPack: selectedPack }, name, toolInput);
          await recordAgentRunEvent(supabase, run, { eventType: "tool_result", toolName: name, input: traceValue(toolInput), output: { result: traceValue(output), impact: tool.impact, confirmation_required: tool.confirmationRequired, service_target: tool.serviceTarget, connection_requirement: tool.connectionRequirement, registry_version: AI_TOOL_REGISTRY_VERSION } });
          transcript.push({ role: "tool", tool_call_id: use.id, content: boundToolResult(name, output) });
          options.onToolCompleted?.({ name, index: toolIndex, summary: toolSummary(output), failed: false });
          const proposal = proposalSummary(output, tool.impact);
          if (proposal) options.onProposalStaged?.(proposal);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool failed";
          await recordAgentRunEvent(supabase, run, { eventType: "tool_error", toolName: name, input: traceValue(toolInput), output: { error: message.slice(0, 500), registry_version: AI_TOOL_REGISTRY_VERSION } });
          transcript.push({ role: "tool", tool_call_id: use.id, content: JSON.stringify({ error: message }) });
          options.onToolCompleted?.({ name, index: toolIndex, summary: message.slice(0, 180), failed: true });
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
    const cancelled = options.signal?.aborted || (error instanceof OpenRouterError && error.status === 499);
    await finishAgentRun(supabase, run, cancelled ? "cancelled" : "failed", { toolNames, inputTokens, outputTokens, error: cancelled ? "Founder cancelled the run" : error instanceof Error ? error.message : "AI run failed" });
    throw error;
  }
}
