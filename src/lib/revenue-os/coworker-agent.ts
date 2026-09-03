import type { SupabaseClient } from "@supabase/supabase-js";
import { tenant } from "@/config/tenant";
import { getOpenRouterModel, openRouterChat, type OpenRouterMessage } from "@/lib/ai/openrouter";
import { getCoworker } from "./coworkers";
import { listWorkspaceCapabilities } from "./capabilities";
import { listLearnedPolicies, retrieveAgentMemory } from "./memory";
import {
  executeRegisteredRevenueTool,
  toOpenRouterTools,
  type RevenueToolPackId,
} from "./ai-tools";
import { finishAgentRun, recordAgentRunEvent, startAgentRun } from "./agent-trace";
import { AI_CONTEXT_VERSION, boundToolResult } from "./ai-context";
import type { WorkItem } from "./work-items";

// ---------------------------------------------------------------------------
// Coworker agent: headless AI execution for coworker work items.
//
// This is the bridge that makes coworkers intelligent. Instead of running
// deterministic SQL + audit writes, a coworker handler can invoke the AI
// agent with its tool pack and the work item's objective, getting back a
// judgment, synthesis, or content generation result.
//
// The founder-facing `runRevenueCommandAgent` is the interactive chat loop.
// This is the headless execution loop — no streaming, no UI callbacks, and
// a coworker-specific system prompt that positions the AI as an executor
// of the coworker's role rather than a founder-facing copilot.
// ---------------------------------------------------------------------------

const MAX_COWORKER_TOOL_TURNS = 3;

function coworkerSystemPrompt(coworkerRole: string, coworkerId: string): string {
  return [
    `You are ${tenant.brand.name}'s ${coworkerRole} coworker (id: ${coworkerId}).`,
    `Your job is to execute the assigned work item using the tools available to you.`,
    `Ground every factual claim in tool results. Never invent numbers, people, pricing, dates, or business facts.`,
    `Read tools may run directly. Every write or outbound action must use a propose_* tool.`,
    `After completing your analysis or action, provide a concise outcome summary.`,
    `If you cannot complete the work with available tools, explain what is missing.`,
    tenant.ai.voice,
  ].join(" ");
}

export interface CoworkerAgentResult {
  outcome: string;
  runId: string;
}

export async function runCoworkerAgentTask(
  supabase: SupabaseClient,
  workItem: WorkItem,
): Promise<CoworkerAgentResult> {
  // Resolve the coworker to get its role and tool pack.
  const coworkerId = workItem.coworker_id;
  if (!coworkerId) {
    return { outcome: "No coworker_id on work item — cannot run coworker agent", runId: "" };
  }

  const coworker = await getCoworker(supabase, coworkerId);
  if (!coworker) {
    return { outcome: `Coworker ${coworkerId} not found — cannot run coworker agent`, runId: "" };
  }
  const toolPack = (coworker.tool_pack ?? "core") as RevenueToolPackId;
  const role = coworker.role ?? coworkerId;

  const model = getOpenRouterModel(process.env.OPENROUTER_AGENT_MODEL);
  const objective = workItem.objective || "No objective specified";

  // Start an agent run trace.
  const run = await startAgentRun(supabase, {
    surface: "coworker_execution",
    actorEmail: `coworker:${coworkerId}`,
    model,
    promptPreview: objective.slice(0, 200),
    provider: "openrouter",
    toolPack,
  });

  const transcript: OpenRouterMessage[] = [
    {
      role: "user",
      content: [
        `Work kind: ${workItem.kind}`,
        `Objective: ${objective}`,
        workItem.entity_type ? `Entity: ${workItem.entity_type}/${workItem.entity_id}` : "",
        workItem.reason ? `Reason: ${workItem.reason}` : "",
        "Execute this work item. Use your tools to gather context, analyze, and take action as needed. Provide a concise outcome when done.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  const toolNames: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    // Load bounded context for the coworker.
    const availableCapabilities = await listWorkspaceCapabilities(supabase, {
      availableOnly: true,
    });
    const capabilitySummary = availableCapabilities.length
      ? `Capabilities: ${availableCapabilities.map((c) => c.capability_key).join(", ")}`
      : "No workspace capabilities registered.";

    const activePolicies = await listLearnedPolicies(supabase);
    const recentMemory = await retrieveAgentMemory(supabase, { limit: 5 });
    const memorySummary =
      [
        activePolicies.length
          ? `Learned policies: ${activePolicies.map((p) => `"${p.rule}"`).join("; ")}`
          : undefined,
        recentMemory.length
          ? `Recent memory: ${recentMemory.map((m) => `${m.subject}`).join("; ")}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    const now = new Date();
    const today = `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} (${now.toISOString().slice(0, 10)}).`;

    for (let turn = 0; turn < MAX_COWORKER_TOOL_TURNS; turn++) {
      const grounding = [today, capabilitySummary, memorySummary].filter(Boolean).join("\n");

      const response = await openRouterChat({
        database: supabase,
        model,
        maxTokens: 800,
        messages: [
          { role: "system", content: `${coworkerSystemPrompt(role, coworkerId)}\n\n${grounding}` },
          ...transcript,
        ],
        tools: toOpenRouterTools(toolPack),
      });

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
        // No tool calls — the agent has finished its reasoning.
        const text = assistant.content?.trim() || "Completed without output";
        await finishAgentRun(supabase, run, "completed", {
          toolNames,
          inputTokens,
          outputTokens,
          resultPreview: text,
        });
        // Link the run to the work item.
        if (workItem.id) {
          await supabase.from("work_items").update({ agent_run_id: run.id }).eq("id", workItem.id);
        }
        return { outcome: text, runId: run.id ?? "" };
      }

      // Execute tool calls.
      for (const use of uses) {
        const name = use.function.name;
        toolNames.push(name);
        let toolInput: Record<string, unknown> = {};
        try {
          toolInput = JSON.parse(use.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          toolInput = {};
        }
        try {
          const { output } = await executeRegisteredRevenueTool(
            { supabase, actorEmail: `coworker:${coworkerId}`, toolPack },
            name,
            toolInput,
          );
          await recordAgentRunEvent(supabase, run, {
            eventType: "tool_result",
            toolName: name,
            input: toolInput,
            output: { result: output },
          });
          transcript.push({
            role: "tool",
            tool_call_id: use.id,
            content: boundToolResult(name, output),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool failed";
          await recordAgentRunEvent(supabase, run, {
            eventType: "tool_error",
            toolName: name,
            input: toolInput,
            output: { error: message.slice(0, 500) },
          });
          transcript.push({
            role: "tool",
            tool_call_id: use.id,
            content: JSON.stringify({ error: message }),
          });
        }
      }
    }

    // Turn exhaustion — return what was gathered.
    const partial =
      transcript
        .filter((entry) => entry.role === "assistant")
        .map((entry) => entry.content?.trim())
        .filter(Boolean)
        .join("\n\n") || `Stopped after ${MAX_COWORKER_TOOL_TURNS} tool turns`;

    await finishAgentRun(supabase, run, "partial", {
      toolNames,
      inputTokens,
      outputTokens,
      resultPreview: partial,
      error: `Stopped after ${MAX_COWORKER_TOOL_TURNS} tool turns`,
    });

    if (workItem.id) {
      await supabase.from("work_items").update({ agent_run_id: run.id }).eq("id", workItem.id);
    }

    return { outcome: partial, runId: run.id ?? "" };
  } catch (error) {
    await finishAgentRun(supabase, run, "failed", {
      toolNames,
      inputTokens,
      outputTokens,
      error: error instanceof Error ? error.message : "Coworker agent run failed",
    });
    return {
      outcome: `AI execution failed: ${error instanceof Error ? error.message : "unknown error"}`,
      runId: run.id ?? "",
    };
  }
}
