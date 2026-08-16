import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSetting } from "@/lib/admin/settings";
import { proposeAction } from "./actions";
import { loadOperatorQueue } from "./queue";
import { REVENUE_STAGES } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

const tools: Anthropic.Tool[] = [
  {
    name: "get_today_snapshot",
    description: "Read the founder's prioritized operator queue and current revenue metrics.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_pipeline",
    description: "Search live opportunities by company or email. Never invent a record or metric.",
    input_schema: { type: "object", properties: { query: { type: "string" }, stage: { type: "string", enum: [...REVENUE_STAGES] } }, additionalProperties: false },
  },
  {
    name: "propose_send_email",
    description: "Stage an outbound email for founder approval. This never sends directly.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, opportunityId: { type: "string" }, contactId: { type: "string" }, reasoning: { type: "string" } },
      required: ["to", "subject", "body", "reasoning"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_stage_change",
    description: "Stage a pipeline movement for founder approval. Evidence must be included.",
    input_schema: {
      type: "object",
      properties: { opportunityId: { type: "string" }, stage: { type: "string", enum: [...REVENUE_STAGES] }, reason: { type: "string" }, lossReason: { type: "string" } },
      required: ["opportunityId", "stage", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_task",
    description: "Stage a concrete operator task for approval.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, description: { type: "string" }, dueDate: { type: "string" }, priority: { type: "string", enum: ["high", "medium", "low"] }, opportunityId: { type: "string" } },
      required: ["title", "priority"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_campaign_activation",
    description: "Stage activation of a reviewed campaign version for founder approval.",
    input_schema: { type: "object", properties: { campaignId: { type: "string" }, reasoning: { type: "string" } }, required: ["campaignId", "reasoning"], additionalProperties: false },
  },
];

async function executeTool(supabase: SupabaseClient, actorEmail: string, name: string, input: Record<string, unknown>) {
  if (name === "get_today_snapshot") {
    const [queue, opportunities, conversations, campaigns, proposals] = await Promise.all([
      loadOperatorQueue(supabase),
      supabase.from("opportunities").select("id,name,stage,estimated_value,won_value,next_action,next_action_at").limit(250),
      supabase.from("conversations").select("id,unread_count,status").limit(250),
      supabase.from("campaigns").select("id,name,status,version,approved_version").limit(100),
      supabase.from("proposals").select("id,title,status,total_one_time,total_monthly").limit(100),
    ]);
    return { queue: queue.slice(0, 20), opportunities: opportunities.data ?? [], conversations: conversations.data ?? [], campaigns: campaigns.data ?? [], proposals: proposals.data ?? [] };
  }
  if (name === "search_pipeline") {
    const query = typeof input.query === "string" ? input.query.replace(/[,%]/g, "").trim() : "";
    let builder = supabase.from("opportunities").select("id,name,email,stage,source,estimated_value,won_value,next_action,next_action_at,last_activity_at").limit(25);
    if (query) builder = builder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
    if (typeof input.stage === "string") builder = builder.eq("stage", input.stage);
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (name === "propose_send_email") {
    return proposeAction(supabase, {
      actionType: "send_email",
      title: `Send email: ${String(input.subject || "Untitled")}`,
      description: String(input.body || "").slice(0, 240),
      urgency: "normal",
      payload: input,
      reasoning: String(input.reasoning || ""),
      sourceContext: "admin_ai",
      entityType: "opportunity",
      entityId: typeof input.opportunityId === "string" ? input.opportunityId : undefined,
      dedupeKey: `ai-email:${String(input.to)}:${String(input.subject)}`.slice(0, 220),
      proposedBy: actorEmail,
      expiresAt,
    });
  }
  if (name === "propose_stage_change") {
    return proposeAction(supabase, {
      actionType: "transition_opportunity",
      title: `Move opportunity to ${String(input.stage)}`,
      description: String(input.reason || ""),
      urgency: "normal",
      payload: input,
      reasoning: String(input.reason || ""),
      sourceContext: "admin_ai",
      entityType: "opportunity",
      entityId: String(input.opportunityId),
      dedupeKey: `ai-stage:${String(input.opportunityId)}:${String(input.stage)}`,
      proposedBy: actorEmail,
      expiresAt,
    });
  }
  if (name === "propose_task") {
    return proposeAction(supabase, {
      actionType: "create_task",
      title: String(input.title),
      description: typeof input.description === "string" ? input.description : undefined,
      urgency: input.priority === "high" ? "high" : "normal",
      payload: { ...input, dedupeKey: `ai-task:${String(input.opportunityId || "general")}:${String(input.title)}`.slice(0, 220) },
      sourceContext: "admin_ai",
      entityType: input.opportunityId ? "opportunity" : undefined,
      entityId: typeof input.opportunityId === "string" ? input.opportunityId : undefined,
      dedupeKey: `ai-task:${String(input.opportunityId || "general")}:${String(input.title)}`.slice(0, 220),
      proposedBy: actorEmail,
      expiresAt,
    });
  }
  if (name === "propose_campaign_activation") {
    return proposeAction(supabase, {
      actionType: "activate_campaign",
      title: "Activate reviewed campaign",
      description: String(input.reasoning || ""),
      urgency: "normal",
      payload: input,
      reasoning: String(input.reasoning || ""),
      sourceContext: "admin_ai",
      entityType: "campaign",
      entityId: String(input.campaignId),
      dedupeKey: `ai-campaign-activate:${String(input.campaignId)}`,
      proposedBy: actorEmail,
      expiresAt,
    });
  }
  throw new Error(`Unknown tool ${name}`);
}

export interface CommandMessage { role: "user" | "assistant"; content: string }

export async function runRevenueCommandAgent(supabase: SupabaseClient, actorEmail: string, messages: CommandMessage[]) {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Anthropic is not configured. Add ANTHROPIC_API_KEY in Vercel.");
  const safeMessages = messages.slice(-12).filter((item) => ["user", "assistant"].includes(item.role) && item.content.trim()).map((item) => ({ role: item.role, content: item.content.slice(0, 8000) }));
  const lastMessage = safeMessages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") throw new Error("A user command is required");
  const { data: run, error: runError } = await supabase.from("agent_runs").insert({ surface: "admin_command", actor_email: actorEmail, model: MODEL, prompt_preview: lastMessage.content.slice(0, 500) }).select("id").single();
  if (runError) throw new Error(runError.message);
  const client = new Anthropic({ apiKey });
  const transcript: Anthropic.MessageParam[] = safeMessages;
  const toolNames: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    for (let turn = 0; turn < 5; turn++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1200,
        system: "You are Accelerate's founder-only Revenue OS copilot. Ground every factual claim in tool results. Never invent numbers, people, pricing, dates, or business facts. Read tools may run directly. Every write or outbound action must use a propose_* tool and clearly tell the founder it is awaiting approval. Prioritize revenue, replies, commitments, meetings, proposals, and campaign exceptions. Be concise and operational.",
        tools,
        messages: transcript,
      });
      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      transcript.push({ role: "assistant", content: response.content });
      const uses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
      if (!uses.length) {
        const text = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map((block) => block.text).join("\n").trim();
        await supabase.from("agent_runs").update({ status: "completed", tool_names: [...new Set(toolNames)], input_tokens: inputTokens, output_tokens: outputTokens, result_preview: text.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", run.id);
        return { text, runId: run.id, proposedActions: toolNames.filter((name) => name.startsWith("propose_")) };
      }
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of uses) {
        toolNames.push(use.name);
        try {
          const output = await executeTool(supabase, actorEmail, use.name, use.input as Record<string, unknown>);
          await supabase.from("agent_run_events").insert({ run_id: run.id, event_type: "tool_result", tool_name: use.name, input: use.input, output });
          results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(output) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool failed";
          await supabase.from("agent_run_events").insert({ run_id: run.id, event_type: "tool_error", tool_name: use.name, input: use.input, output: { error: message } });
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: message });
        }
      }
      transcript.push({ role: "user", content: results });
    }
    throw new Error("The AI exceeded the maximum tool turns");
  } catch (error) {
    await supabase.from("agent_runs").update({ status: "failed", tool_names: [...new Set(toolNames)], input_tokens: inputTokens, output_tokens: outputTokens, error: error instanceof Error ? error.message : "AI run failed", finished_at: new Date().toISOString() }).eq("id", run.id);
    throw error;
  }
}
