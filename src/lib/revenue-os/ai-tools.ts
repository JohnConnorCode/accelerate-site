import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenRouterTool } from "@/lib/ai/openrouter";
import { proposeAction } from "./actions";
import { loadOperatorQueue } from "./queue";
import { REVENUE_STAGES } from "./types";

export const AI_TOOL_REGISTRY_VERSION = "revenue-os-tools.v1";
export type AiToolImpact = "read" | "internal_write" | "external_action" | "destructive";
type AiToolContext = { supabase: SupabaseClient; actorEmail: string };
type AiToolRegistration = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  impact: AiToolImpact;
  confirmationRequired: boolean;
  execute: (context: AiToolContext, input: Record<string, unknown>) => Promise<unknown>;
};

function value(input: Record<string, unknown>, key: string): string | undefined {
  const result = typeof input[key] === "string" ? input[key].trim() : "";
  return result || undefined;
}

const registry: AiToolRegistration[] = [
  { name: "get_today_snapshot", description: "Read the founder's prioritized operator queue and current revenue metrics.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, impact: "read", confirmationRequired: false, execute: async ({ supabase }) => {
    const [queue, opportunities, conversations, campaigns, proposals] = await Promise.all([loadOperatorQueue(supabase), supabase.from("opportunities").select("id,name,stage,estimated_value,won_value,next_action,next_action_at").limit(250), supabase.from("conversations").select("id,unread_count,status").limit(250), supabase.from("campaigns").select("id,name,status,version,approved_version").limit(100), supabase.from("proposals").select("id,title,status,total_one_time,total_monthly").limit(100)]);
    return { queue: queue.slice(0, 20), opportunities: opportunities.data ?? [], conversations: conversations.data ?? [], campaigns: campaigns.data ?? [], proposals: proposals.data ?? [] };
  } },
  { name: "search_pipeline", description: "Search live opportunities by company or email. Never invent a record or metric.", inputSchema: { type: "object", properties: { query: { type: "string" }, stage: { type: "string", enum: [...REVENUE_STAGES] } }, additionalProperties: false }, impact: "read", confirmationRequired: false, execute: async ({ supabase }, input) => {
    const query = (value(input, "query") || "").replace(/[,%]/g, "");
    let builder = supabase.from("opportunities").select("id,name,email,stage,source,estimated_value,won_value,next_action,next_action_at,last_activity_at").limit(25);
    if (query) builder = builder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
    if (typeof input.stage === "string" && REVENUE_STAGES.includes(input.stage as typeof REVENUE_STAGES[number])) builder = builder.eq("stage", input.stage);
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return data ?? [];
  } },
  { name: "propose_send_email", description: "Stage an outbound email for founder approval. This never sends directly.", inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, opportunityId: { type: "string" }, contactId: { type: "string" }, reasoning: { type: "string" } }, required: ["to", "subject", "body", "reasoning"], additionalProperties: false }, impact: "external_action", confirmationRequired: true, execute: async ({ supabase, actorEmail }, input) => proposeAction(supabase, { actionType: "send_email", title: `Send email: ${value(input, "subject") || "Untitled"}`, description: String(input.body || "").slice(0, 240), urgency: "normal", payload: input, reasoning: value(input, "reasoning") || "", sourceContext: "admin_ai", entityType: "opportunity", entityId: value(input, "opportunityId"), dedupeKey: `ai-email:${value(input, "to")}:${value(input, "subject")}`.slice(0, 220), proposedBy: actorEmail, expiresAt: new Date(Date.now() + 86400000).toISOString() }) },
  { name: "propose_stage_change", description: "Stage a pipeline movement for founder approval. Evidence must be included.", inputSchema: { type: "object", properties: { opportunityId: { type: "string" }, stage: { type: "string", enum: [...REVENUE_STAGES] }, reason: { type: "string" }, lossReason: { type: "string" } }, required: ["opportunityId", "stage", "reason"], additionalProperties: false }, impact: "internal_write", confirmationRequired: true, execute: async ({ supabase, actorEmail }, input) => proposeAction(supabase, { actionType: "transition_opportunity", title: `Move opportunity to ${value(input, "stage")}`, description: value(input, "reason") || "", urgency: "normal", payload: input, reasoning: value(input, "reason") || "", sourceContext: "admin_ai", entityType: "opportunity", entityId: value(input, "opportunityId"), dedupeKey: `ai-stage:${value(input, "opportunityId")}:${value(input, "stage")}`, proposedBy: actorEmail, expiresAt: new Date(Date.now() + 86400000).toISOString() }) },
  { name: "propose_task", description: "Stage a concrete operator task for approval.", inputSchema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, dueDate: { type: "string" }, priority: { type: "string", enum: ["high", "medium", "low"] }, opportunityId: { type: "string" } }, required: ["title", "priority"], additionalProperties: false }, impact: "internal_write", confirmationRequired: true, execute: async ({ supabase, actorEmail }, input) => {
    const dedupeKey = `ai-task:${value(input, "opportunityId") || "general"}:${value(input, "title")}`.slice(0, 220);
    return proposeAction(supabase, { actionType: "create_task", title: value(input, "title") || "Untitled task", description: value(input, "description"), urgency: input.priority === "high" ? "high" : "normal", payload: { ...input, dedupeKey }, sourceContext: "admin_ai", entityType: value(input, "opportunityId") ? "opportunity" : undefined, entityId: value(input, "opportunityId"), dedupeKey, proposedBy: actorEmail, expiresAt: new Date(Date.now() + 86400000).toISOString() });
  } },
  { name: "propose_campaign_activation", description: "Stage activation of a reviewed campaign version for founder approval.", inputSchema: { type: "object", properties: { campaignId: { type: "string" }, reasoning: { type: "string" } }, required: ["campaignId", "reasoning"], additionalProperties: false }, impact: "external_action", confirmationRequired: true, execute: async ({ supabase, actorEmail }, input) => proposeAction(supabase, { actionType: "activate_campaign", title: "Activate reviewed campaign", description: value(input, "reasoning") || "", urgency: "normal", payload: input, reasoning: value(input, "reasoning") || "", sourceContext: "admin_ai", entityType: "campaign", entityId: value(input, "campaignId"), dedupeKey: `ai-campaign-activate:${value(input, "campaignId")}`, proposedBy: actorEmail, expiresAt: new Date(Date.now() + 86400000).toISOString() }) },
];

export function getRevenueAiTools(): AiToolRegistration[] { return registry; }
export function toOpenRouterTools(): OpenRouterTool[] { return registry.map(({ name, description, inputSchema }) => ({ type: "function", function: { name, description, parameters: inputSchema } })); }
export async function executeRegisteredRevenueTool(context: AiToolContext, name: string, input: Record<string, unknown>) {
  const tool = registry.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Tool ${name} is not registered`);
  return { output: await tool.execute(context, input), tool };
}
