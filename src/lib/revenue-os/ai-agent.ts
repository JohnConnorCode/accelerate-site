import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenant } from "@/config/tenant";
import {
  getOpenRouterModel,
  openRouterChat,
  openRouterChatStream,
  OpenRouterError,
  type OpenRouterMessage,
} from "@/lib/ai/openrouter";
import { loadAgentLearningSignals } from "./agent-learning";
import { listClaimableWork } from "./work-items";
import { listWorkspaceCapabilities } from "./capabilities";
import { listClaimsForEntity } from "./claims";
import { retrieveAgentMemory } from "./memory";
import { loadContextPack, contextReceipt } from "./shared-context";
import {
  AI_TOOL_REGISTRY_VERSION,
  canRunRevenueAiToolCallsConcurrently,
  executeRegisteredRevenueTool,
  selectRevenueToolPack,
  toActivatedOpenRouterTools,
  availableRevenueToolBundles,
  refreshRevenueToolContext,
  type RevenueToolPackId,
} from "./ai-tools";
import { finishAgentRun, recordAgentRunEvent, startAgentRun } from "./agent-trace";
import {
  AI_CONTEXT_VERSION,
  boundFounderConversation,
  boundToolResult,
  buildRevenueAiGroundingContract,
  groundedAnswerFailure,
  validateGroundedRevenueAnswer,
} from "./ai-context";

/** Tool steps allowed before the run reports what it has and stops. */
export const MAX_TOOL_TURNS = 5;
export const SYSTEM_CONTRACT = `You are ${tenant.brand.name}'s founder-only Revenue OS copilot. Ground every factual claim in tool results. Never invent numbers, people, pricing, dates, or business facts. Read tools may run directly. Every write or outbound action must use a propose_* tool and clearly tell the founder it is awaiting approval. When the founder asks for a write or outbound action, gather what it needs and stage it in this run; approval is the confirmation step, so do not stop to ask permission first. Prioritize revenue, replies, commitments, meetings, proposals, and campaign exceptions. Stripe remains the payment authority. Subscription checkout and account management are customer-facing workflows; do not claim a charge, renewal, invoice, or subscription change without current registered evidence, and do not attempt those actions unless a registered tool explicitly exposes them. ${tenant.ai.voice}`;

export interface CommandMessage {
  role: "user" | "assistant";
  content: string;
}
export interface CommandPageContext {
  pathname: string;
  entity?: { type: "opportunity" | "contact" | "company"; id: string };
}
export interface AgentProposalSummary {
  id: string;
  actionType: string;
  title: string;
  impact: string;
  entityType: string | null;
  entityId: string | null;
}
export interface CommandAgentOptions {
  surface?: string;
  conversationId?: string | null;
  activeToolBundleId?: string | null;
  architectEvidence?: string | null;
  pageContext?: CommandPageContext | null;
  /** The calling tenant's active module configuration, so a disabled module's
   * AI tools are unavailable to the agent exactly as they are to the UI and
   * to MCP. Falls back to every optional module enabled when omitted. */
  tenantConfig?: { modules?: Partial<Record<string, boolean>> } | null;
  signal?: AbortSignal;
  onRunStarted?: (event: { runId: string | null; model: string; pack: RevenueToolPackId }) => void;
  onAssistantDelta?: (delta: string) => void;
  onToolStarted?: (event: { name: string; index: number }) => void;
  onToolCompleted?: (event: {
    name: string;
    index: number;
    summary: string;
    failed: boolean;
  }) => void;
  onProposalStaged?: (proposal: AgentProposalSummary) => void;
}

function safePageContext(context: CommandPageContext | null | undefined): string {
  if (!context?.pathname.startsWith("/admin")) return "";
  const pathname = context.pathname.slice(0, 240);
  if (!context.entity)
    return `The founder opened this assistant from ${pathname}. Use that only as navigation context.`;
  const id = context.entity.id.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return `The founder opened this assistant from ${pathname}.`;
  return `The founder opened this assistant from ${pathname}, focused on canonical ${context.entity.type} ${id}. Use registered read tools to verify every record fact before answering.`;
}

function traceValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[bounded]";
  if (typeof value === "string")
    return value.length > 240 ? `${value.slice(0, 180)}… [${value.length} chars]` : value;
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
  if (typeof row.action_type === "string")
    return `Staged ${row.action_type.replace(/_/g, " ")} for approval`;
  if (Array.isArray(row.activities))
    return `${row.activities.length} timeline event${row.activities.length === 1 ? "" : "s"}`;
  const counts = Object.entries(row)
    .filter(([, value]) => typeof value === "number")
    .slice(0, 3)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${value}`);
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

export async function runRevenueCommandAgent(
  supabase: SupabaseClient,
  actorEmail: string,
  messages: CommandMessage[],
  options: CommandAgentOptions = {},
) {
  const safeMessages = boundFounderConversation(messages);
  const lastMessage = safeMessages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") throw new Error("A user command is required");
  const model = getOpenRouterModel(process.env.OPENROUTER_AGENT_MODEL);
  const selectedPack =
    options.pageContext?.entity?.type === "opportunity"
      ? "pipeline"
      : selectRevenueToolPack(lastMessage.content);
  const run = await startAgentRun(supabase, {
    surface: options.surface ?? "admin_command",
    actorEmail,
    model,
    promptPreview: lastMessage.content,
    conversationId: options.conversationId,
    provider: "openrouter",
    toolPack: selectedPack,
  });
  options.onRunStarted?.({ runId: run.id, model, pack: selectedPack });

  const transcript: OpenRouterMessage[] = safeMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const toolNames: string[] = [];
  const stagedToolNames = new Set<string>();
  let activeBundleId =
    typeof options.activeToolBundleId === "string" && options.activeToolBundleId.length <= 160
      ? options.activeToolBundleId || null
      : null;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const learningSignals = await loadAgentLearningSignals(supabase);
    // Bounded work-item summary so the agent knows what durable work is queued.
    const claimableWork = await listClaimableWork(supabase, { limit: 10 });
    const workQueueSummary = claimableWork.length
      ? `Work engine queue (${claimableWork.length} claimable): ${claimableWork.map((w) => `${w.kind}[${w.priority}](${w.objective.slice(0, 60)})`).join("; ")}. Use get_claimable_work for details.`
      : "Work engine queue is empty — no claimable work items.";
    // Bounded capability summary so the agent knows what the workspace can do.
    const availableCapabilities = await listWorkspaceCapabilities(supabase, {
      availableOnly: true,
    });
    const capabilitySummary = availableCapabilities.length
      ? `Workspace capabilities (${availableCapabilities.length} available): ${availableCapabilities.map((c) => `${c.capability_key}${c.policy === "approval_required" ? "[approval]" : ""}`).join(", ")}. Use get_workspace_capabilities for details.`
      : "No provider capabilities are registered yet. That does not limit your tools: every advertised tool, including propose_* drafts that wait for approval, is available.";
    // Entity-scoped claims summary when page context has an entity.
    let claimsSummary: string | undefined;
    const pageEntity = options.pageContext?.entity;
    if (pageEntity) {
      const entityClaims = await listClaimsForEntity(supabase, {
        entityType: pageEntity.type,
        entityId: pageEntity.id,
        status: ["unverified", "supported", "conflicted", "verified"],
      });
      if (entityClaims.length) {
        claimsSummary = `Claims for ${pageEntity.type} (${entityClaims.length}): ${entityClaims.map((c) => `${c.field}=${c.proposed_value}[${c.status}/${c.best_evidence ?? "?"}]`).join("; ")}. Use get_claims_for_entity for details.`;
      }
    }
    // Memory summary: active learned policies + recent agent memory.
    const contextPack = await loadContextPack(supabase, { entity: pageEntity ?? undefined });
    await recordAgentRunEvent(supabase, run, {
      eventType: "context_loaded",
      output: contextReceipt(contextPack),
    });
    const recentAgentMemory = await retrieveAgentMemory(supabase, { limit: 5 });
    const memorySummary =
      [
        contextPack.text,
        recentAgentMemory.length
          ? `Recent agent memory (${recentAgentMemory.length}): ${recentAgentMemory.map((m) => `${m.category}: ${m.subject}`).join("; ")}. Use get_agent_memory for details.`
          : undefined,
      ]
        .filter(Boolean)
        .join(" ") || undefined;
    // Without this the model reasons about "today" and "follow up in 3 days"
    // from its training cutoff. Everything this agent does is time-sensitive.
    const now = new Date();
    const today = `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" })} (${now.toISOString().slice(0, 10)}). Use this for every relative date; never infer the date from memory.`;
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const context = safePageContext(options.pageContext);
      const grounding = buildRevenueAiGroundingContract({
        today,
        learningSignals,
        workQueueSummary,
        capabilitySummary,
        claimsSummary,
        memorySummary,
        pageContext: context,
        toolPack: activeBundleId ?? "bounded core with cross-domain discovery",
      });
      const liveContext = await refreshRevenueToolContext({
        supabase,
        actorEmail,
        conversationId: options.conversationId,
        tenantConfig: options.tenantConfig,
      });
      if (
        activeBundleId &&
        !availableRevenueToolBundles(liveContext).some(
          (bundle) => bundle.bundleId === activeBundleId,
        )
      )
        activeBundleId = null;
      const activeTools = toActivatedOpenRouterTools(activeBundleId, liveContext);
      const advertisedNames = new Set(activeTools.map((tool) => tool.function.name));
      const activationScope = options.conversationId
        ? "Activation remains selected in this conversation across reloads, subject to current permission and availability checks."
        : "Activation applies to subsequent turns in this command run only.";
      const request = {
        database: supabase,
        job: "copilot-answer",
        model,
        maxTokens: 1200,
        signal: options.signal,
        messages: [
          {
            role: "system" as const,
            content: `${SYSTEM_CONTRACT}\n\n${grounding}${options.architectEvidence ? `\n\n${options.architectEvidence}` : ""}\nThe initial pack is navigation context only. Use discover_tool_bundles for any admin capability missing from the current tools, then activate_tool_bundle. ${activationScope} It does not approve actions. Only call tools advertised on this turn. Active bundle: ${activeBundleId ?? "core only"}.`,
          },
          ...transcript,
        ],
        tools: activeTools,
      };
      let bufferedAnswer = "";
      const response = options.onAssistantDelta
        ? await openRouterChatStream(request, (delta) => {
            bufferedAnswer += delta;
          })
        : await openRouterChat(request);
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;
      const assistant = response.choices[0]?.message;
      if (!assistant) throw new Error("OpenRouter returned no assistant response");
      transcript.push(assistant);
      await recordAgentRunEvent(supabase, run, {
        eventType: "model_response",
        output: {
          provider: "openrouter",
          request_id: response.id,
          model: response.model,
          usage: response.usage ?? {},
          turn,
          context_version: AI_CONTEXT_VERSION,
        },
      });
      const uses = assistant.tool_calls ?? [];
      if (!uses.length) {
        const text = assistant.content?.trim() || "";
        const grounding = validateGroundedRevenueAnswer(text, toolNames);
        if (!grounding.valid) {
          const safeAnswer = groundedAnswerFailure(
            grounding.reason || "The answer could not be verified",
          );
          options.onAssistantDelta?.(safeAnswer);
          await finishAgentRun(supabase, run, "partial", {
            toolNames,
            inputTokens,
            outputTokens,
            resultPreview: safeAnswer,
            error: grounding.reason || "Grounding contract rejected the answer",
          });
          return {
            text: safeAnswer,
            runId: run.id,
            proposedActions: [...stagedToolNames],
            activeToolBundleId: activeBundleId,
          };
        }
        if (options.onAssistantDelta) options.onAssistantDelta(bufferedAnswer || text);
        await finishAgentRun(supabase, run, "completed", {
          toolNames,
          inputTokens,
          outputTokens,
          resultPreview: text,
        });
        return {
          text,
          runId: run.id,
          proposedActions: [...stagedToolNames],
          activeToolBundleId: activeBundleId,
        };
      }
      const processToolUse = async (use: (typeof uses)[number], toolIndex: number) => {
        const name = use.function.name;
        toolNames[toolIndex] = name;
        options.onToolStarted?.({ name, index: toolIndex });
        let toolInput: Record<string, unknown> = {};
        try {
          toolInput = JSON.parse(use.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          toolInput = {};
        }
        try {
          if (!advertisedNames.has(name))
            throw new Error(
              `Tool ${name} is not loaded on this turn. Discover and activate its bundle first.`,
            );
          const dispatchContext = await refreshRevenueToolContext({
            supabase,
            actorEmail,
            conversationId: options.conversationId,
            tenantConfig: options.tenantConfig,
          });
          const { output, tool } = await executeRegisteredRevenueTool(
            dispatchContext,
            name,
            toolInput,
          );
          if (name === "activate_tool_bundle") {
            activeBundleId = (output as { activeBundleId: string }).activeBundleId;
          }
          await recordAgentRunEvent(supabase, run, {
            eventType: "tool_result",
            toolName: name,
            input: traceValue(toolInput),
            output: {
              result: traceValue(output),
              impact: tool.impact,
              confirmation_required: tool.confirmationRequired,
              service_target: tool.serviceTarget,
              connection_requirement: tool.connectionRequirement,
              registry_version: AI_TOOL_REGISTRY_VERSION,
            },
          });
          const reply: OpenRouterMessage = {
            role: "tool",
            tool_call_id: use.id,
            content: boundToolResult(name, output),
          };
          options.onToolCompleted?.({
            name,
            index: toolIndex,
            summary: toolSummary(output),
            failed: false,
          });
          const proposal = proposalSummary(output, tool.impact);
          if (proposal) {
            stagedToolNames.add(name);
            options.onProposalStaged?.(proposal);
          }
          return reply;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool failed";
          await recordAgentRunEvent(supabase, run, {
            eventType: "tool_error",
            toolName: name,
            input: traceValue(toolInput),
            output: { error: message.slice(0, 500), registry_version: AI_TOOL_REGISTRY_VERSION },
          });
          const reply: OpenRouterMessage = {
            role: "tool",
            tool_call_id: use.id,
            content: JSON.stringify({ error: message }),
          };
          options.onToolCompleted?.({
            name,
            index: toolIndex,
            summary: message.slice(0, 180),
            failed: true,
          });
          return reply;
        }
      };
      const firstToolIndex = toolNames.length;
      const toolResults = canRunRevenueAiToolCallsConcurrently(uses.map((use) => use.function.name))
        ? await Promise.all(uses.map((use, index) => processToolUse(use, firstToolIndex + index)))
        : await (async () => {
            const results: OpenRouterMessage[] = [];
            for (const use of uses) results.push(await processToolUse(use, toolNames.length));
            return results;
          })();
      transcript.push(...toolResults);
    }
    // Turn exhaustion used to throw: the founder lost the whole answer, the run
    // was marked failed, and any propose_* actions staged on earlier turns
    // stayed in the queue as orphans with no conversation explaining them.
    // Return what was gathered and name the proposals instead.
    const staged = [...stagedToolNames];
    const partial = [
      transcript
        .filter((entry) => entry.role === "assistant")
        .map((entry) => entry.content?.trim())
        .filter(Boolean)
        .join("\n\n"),
      `I stopped after ${MAX_TOOL_TURNS} tool steps without reaching a final answer. Ask me a narrower question and I will finish it.`,
      staged.length
        ? `Already staged for your approval: ${staged.join(", ")}. Review them in the approval queue, or reject them if this run went off track.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    await finishAgentRun(supabase, run, "partial", {
      toolNames,
      inputTokens,
      outputTokens,
      resultPreview: partial,
      error: `Stopped after ${MAX_TOOL_TURNS} tool turns without a final answer`,
    });
    return {
      text: partial,
      runId: run.id,
      proposedActions: staged,
      activeToolBundleId: activeBundleId,
    };
  } catch (error) {
    const cancelled =
      options.signal?.aborted || (error instanceof OpenRouterError && error.status === 499);
    await finishAgentRun(supabase, run, cancelled ? "cancelled" : "failed", {
      toolNames,
      inputTokens,
      outputTokens,
      error: cancelled
        ? "Founder cancelled the run"
        : error instanceof Error
          ? error.message
          : "AI run failed",
    });
    throw error;
  }
}
