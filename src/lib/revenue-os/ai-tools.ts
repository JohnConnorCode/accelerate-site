import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenRouterTool } from "@/lib/ai/openrouter";
import { proposeAction } from "./actions";
import { loadOperatorQueue } from "./queue";
import { REVENUE_STAGES } from "./types";
import { loadActivityTimeline } from "./activities";

export const AI_TOOL_REGISTRY_VERSION = "revenue-os-tools.v3";
export const REVENUE_TOOL_PACKS = ["core", "pipeline", "outreach"] as const;
export type RevenueToolPackId = (typeof REVENUE_TOOL_PACKS)[number];

/** How many rows any single snapshot query may read. */
const SNAPSHOT_ROW_LIMIT = 50;
/** How many of those are returned in full to the model. */
const SNAPSHOT_DETAIL_LIMIT = 10;
export type AiToolImpact = "read" | "internal_write" | "external_action" | "destructive";
type AiToolContext = { supabase: SupabaseClient; actorEmail: string; toolPack?: RevenueToolPackId };
type AiToolRegistration = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  /** The reviewed service boundary a tool is permitted to call. */
  serviceTarget: string;
  /** Current tools stage through Revenue OS; none calls a provider directly. */
  connectionRequirement: "none";
  impact: AiToolImpact;
  confirmationRequired: boolean;
  execute: (context: AiToolContext, input: Record<string, unknown>) => Promise<unknown>;
};

export interface RevenueAiCapabilityDescriptor {
  name: string;
  description: string;
  impact: AiToolImpact;
  confirmationRequired: boolean;
  packs: RevenueToolPackId[];
  serviceTarget: string;
  connectionRequirement: "none";
  available: boolean;
  availabilityReason: string;
}

const ACTION_OUTPUT_SCHEMA = {
  type: "object",
  required: ["id", "action_type"],
  properties: { id: { type: "string" }, action_type: { type: "string" } },
};
const ARRAY_OUTPUT_SCHEMA = { type: "array", items: { type: "object" } };
const SNAPSHOT_OUTPUT_SCHEMA = {
  type: "object",
  required: [
    "unreadable",
    "queue",
    "openOpportunityCount",
    "openPipelineValue",
    "topOpportunities",
    "unreadConversationCount",
    "activeCampaigns",
    "openProposals",
    "truncated",
  ],
  properties: {
    unreadable: { type: "array" },
    queue: { type: "array" },
    openOpportunityCount: { type: "number" },
    openPipelineValue: { type: "number" },
    topOpportunities: { type: "array" },
    unreadConversationCount: { type: "number" },
    activeCampaigns: { type: "array" },
    openProposals: { type: "array" },
    truncated: { type: "boolean" },
  },
};
const TIMELINE_OUTPUT_SCHEMA = {
  type: "object",
  required: ["activities", "truncated"],
  properties: { activities: { type: "array" }, truncated: { type: "boolean" } },
};

function value(input: Record<string, unknown>, key: string): string | undefined {
  const result = typeof input[key] === "string" ? input[key].trim() : "";
  return result || undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The queue card shows a preview; the full body lives in `payload` and is what
 * the approval dialog renders. Marking it as truncated stops the preview from
 * reading like the whole message.
 */
function previewOf(body: string): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.length > 240 ? `${collapsed.slice(0, 237)}...` : collapsed;
}

/**
 * Reject a malformed recipient when the proposal is made, not when it executes.
 * The model sees the error and can correct itself; otherwise an unapprovable
 * proposal sits in the founder's queue looking legitimate.
 */
function requireEmail(candidate: string | undefined): string {
  if (!candidate || !EMAIL_PATTERN.test(candidate)) {
    throw new Error("A valid recipient email address is required before an email can be staged");
  }
  return candidate;
}

/**
 * Validate model output against the tool's declared schema.
 *
 * The schemas were advertised to the model and enforced nowhere: whatever the
 * model produced was handed straight to `execute`. A missing recipient became
 * `undefined` inside a dedupe key, and an unknown field was silently accepted.
 * Only the small JSON Schema subset the registry actually uses is supported,
 * deliberately, so this stays readable and has no dependency.
 *
 * Messages are written for the model, because the agent feeds tool errors back
 * into the transcript and a good message is what lets it correct itself.
 */
export function validateToolInput(
  toolName: string,
  schema: Record<string, unknown>,
  input: Record<string, unknown>,
): void {
  const properties = (schema.properties ?? {}) as Record<
    string,
    { type?: string; enum?: unknown[] }
  >;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const allowExtra = schema.additionalProperties !== false;

  for (const key of required) {
    const supplied = input[key];
    const missing =
      supplied === undefined ||
      supplied === null ||
      (typeof supplied === "string" && !supplied.trim());
    if (missing) {
      throw new Error(`${toolName} requires "${key}". Supply it and call the tool again.`);
    }
  }

  for (const [key, raw] of Object.entries(input)) {
    const spec = properties[key];
    if (!spec) {
      if (allowExtra) continue;
      throw new Error(
        `${toolName} does not accept "${key}". Allowed fields: ${Object.keys(properties).join(", ") || "none"}.`,
      );
    }
    if (raw === undefined || raw === null) continue;
    if (spec.type === "string" && typeof raw !== "string") {
      throw new Error(`${toolName} expects "${key}" to be a string.`);
    }
    if (spec.type === "number" && typeof raw !== "number") {
      throw new Error(`${toolName} expects "${key}" to be a number.`);
    }
    if (spec.type === "boolean" && typeof raw !== "boolean") {
      throw new Error(`${toolName} expects "${key}" to be true or false.`);
    }
    if (Array.isArray(spec.enum) && !spec.enum.includes(raw)) {
      throw new Error(`${toolName} expects "${key}" to be one of: ${spec.enum.join(", ")}.`);
    }
  }
}

/**
 * Outputs are contracts too. The model can only reason safely about a result
 * whose shape is known, and a changed service response must fail in the
 * registry rather than quietly enter a transcript.
 */
export function validateToolOutput(
  toolName: string,
  schema: Record<string, unknown>,
  output: unknown,
): void {
  const type = typeof schema.type === "string" ? schema.type : undefined;
  if (type === "array") {
    if (!Array.isArray(output))
      throw new Error(`${toolName} returned an invalid output: expected an array.`);
    return;
  }
  if (type !== "object") return;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error(`${toolName} returned an invalid output: expected an object.`);
  }
  const record = output as Record<string, unknown>;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const properties = (schema.properties ?? {}) as Record<string, { type?: string }>;
  for (const key of required) {
    if (record[key] === undefined || record[key] === null) {
      throw new Error(`${toolName} returned an invalid output: missing "${key}".`);
    }
  }
  for (const [key, spec] of Object.entries(properties)) {
    const result = record[key];
    if (result === undefined || result === null || !spec.type) continue;
    if (spec.type === "array" && !Array.isArray(result))
      throw new Error(`${toolName} returned an invalid output: "${key}" must be an array.`);
    if (spec.type === "number" && (typeof result !== "number" || !Number.isFinite(result)))
      throw new Error(`${toolName} returned an invalid output: "${key}" must be a finite number.`);
    if (spec.type !== "array" && spec.type !== "number" && typeof result !== spec.type)
      throw new Error(`${toolName} returned an invalid output: "${key}" must be a ${spec.type}.`);
  }
}

function availabilityFor(
  tool: AiToolRegistration,
  context?: Pick<AiToolContext, "toolPack">,
): { available: boolean; reason: string } {
  if (context?.toolPack && !PACK_TOOL_NAMES[context.toolPack].includes(tool.name)) {
    return {
      available: false,
      reason: `${tool.name} is not available in the ${context.toolPack} tool pack.`,
    };
  }
  // A proposal is not a provider side effect. These tools call bounded
  // Revenue OS services/action_queue only, so a missing mail or Google
  // connection cannot incorrectly hide a safe draft or approval request.
  return {
    available: true,
    reason:
      "Available through the bounded Revenue OS service; no provider connection is called directly.",
  };
}

/**
 * The impact tier has to mean something.
 *
 * It was declared on every tool and read in exactly one place, a trace log
 * line, so nothing ever branched on it. The system was safe only because every
 * mutating tool happened to call proposeAction; a future tool tagged `read`
 * could have written directly and nothing would have objected.
 *
 * A mutating tool must come back with a queued proposal, and a read tool must
 * not. That is checkable from the result and catches the mislabelling case in
 * both directions.
 */
export function assertImpactHonoured(tool: AiToolRegistration, output: unknown): void {
  const proposalId = (output as { id?: unknown } | null)?.id;
  const staged = typeof proposalId === "string" && proposalId.length > 0;

  if (tool.impact === "read" && staged) {
    throw new Error(
      `${tool.name} is registered as a read tool but produced a queued action. Re-register it with the correct impact before using it.`,
    );
  }
  if ((tool.impact === "internal_write" || tool.impact === "external_action") && !staged) {
    throw new Error(
      `${tool.name} is registered as ${tool.impact} but did not stage an action for approval. Mutating tools must propose; they never act directly.`,
    );
  }
}

const registry: AiToolRegistration[] = [
  {
    name: "get_today_snapshot",
    description:
      "Read the founder's prioritized operator queue and a summary of current revenue state. Returns counts and the top items, not the full database.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: SNAPSHOT_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.operator-queue",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }) => {
      // This used to pull 250 opportunities and 250 conversations and stringify
      // them whole into a transcript that is re-sent on every turn, which on a
      // real dataset alone can exhaust the context window. It also swallowed
      // every query error with `?? []`, so a failed read became a confident
      // "you have no opportunities": hallucination by omission, invisible to
      // everyone. Summarise, cap, and report failures honestly instead.
      const [queue, opportunities, conversations, campaigns, proposals] = await Promise.all([
        loadOperatorQueue(supabase),
        supabase
          .from("opportunities")
          .select("id,name,stage,estimated_value,won_value,next_action,next_action_at")
          .not("stage", "in", "(won,lost)")
          .order("next_action_at", { ascending: true, nullsFirst: false })
          .limit(SNAPSHOT_ROW_LIMIT),
        supabase
          .from("conversations")
          .select("id,unread_count,status")
          .gt("unread_count", 0)
          .limit(SNAPSHOT_ROW_LIMIT),
        supabase
          .from("campaigns")
          .select("id,name,status,version,approved_version")
          .limit(SNAPSHOT_ROW_LIMIT),
        supabase
          .from("proposals")
          .select("id,title,status,total_one_time,total_monthly")
          .in("status", ["sent", "viewed"])
          .limit(SNAPSHOT_ROW_LIMIT),
      ]);

      const unreadable = [
        opportunities.error && "opportunities",
        conversations.error && "conversations",
        campaigns.error && "campaigns",
        proposals.error && "proposals",
      ].filter(Boolean) as string[];

      const openOpportunities = opportunities.data ?? [];
      return {
        // Anything that could not be read is named, so the model says "I could
        // not check that" instead of reporting an empty result as a fact.
        unreadable,
        queue: queue.slice(0, 15),
        openOpportunityCount: openOpportunities.length,
        openPipelineValue: openOpportunities.reduce(
          (sum, item) => sum + Number(item.estimated_value || 0),
          0,
        ),
        topOpportunities: openOpportunities.slice(0, SNAPSHOT_DETAIL_LIMIT),
        unreadConversationCount: (conversations.data ?? []).reduce(
          (sum, item) => sum + Number(item.unread_count || 0),
          0,
        ),
        activeCampaigns: (campaigns.data ?? [])
          .filter((item) => item.status === "active")
          .map((item) => ({
            id: item.id,
            name: item.name,
            awaitingReapproval: item.version !== item.approved_version,
          })),
        openProposals: (proposals.data ?? []).slice(0, SNAPSHOT_DETAIL_LIMIT),
        truncated: openOpportunities.length >= SNAPSHOT_ROW_LIMIT,
      };
    },
  },
  {
    name: "search_pipeline",
    description: "Search live opportunities by company or email. Never invent a record or metric.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        stage: { type: "string", enum: [...REVENUE_STAGES] },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.pipeline-search",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const query = (value(input, "query") || "").replace(/[,%]/g, "");
      let builder = supabase
        .from("opportunities")
        .select(
          "id,name,email,stage,source,estimated_value,won_value,next_action,next_action_at,last_activity_at",
        )
        .limit(25);
      if (query) builder = builder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
      if (
        typeof input.stage === "string" &&
        REVENUE_STAGES.includes(input.stage as (typeof REVENUE_STAGES)[number])
      )
        builder = builder.eq("stage", input.stage);
      const { data, error } = await builder;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  },
  {
    name: "get_record_timeline",
    description:
      "Read the bounded canonical activity timeline for one contact, company, or opportunity. Every item includes its source receipt and occurrence time.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        companyId: { type: "string" },
        opportunityId: { type: "string" },
      },
      additionalProperties: false,
    },
    outputSchema: TIMELINE_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.activity-ledger",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const ids = {
        contactId: value(input, "contactId"),
        companyId: value(input, "companyId"),
        opportunityId: value(input, "opportunityId"),
      };
      if (Object.values(ids).filter(Boolean).length !== 1)
        throw new Error("Supply exactly one canonical contactId, companyId, or opportunityId");
      const activities = await loadActivityTimeline(supabase, { ...ids, limit: 25 });
      return {
        activities: activities.map((activity) => ({
          id: activity.id,
          type: activity.activity_type,
          title: activity.title,
          summary: activity.summary,
          source: activity.source,
          sourceReceipt: activity.external_id,
          occurredAt: activity.occurred_at,
        })),
        truncated: activities.length === 25,
      };
    },
  },
  {
    name: "propose_send_email",
    description: "Stage an outbound email for founder approval. This never sends directly.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        opportunityId: { type: "string" },
        contactId: { type: "string" },
        reasoning: { type: "string" },
      },
      required: ["to", "subject", "body", "reasoning"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "external_action",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) => {
      requireEmail(value(input, "to"));
      return proposeAction(supabase, {
        actionType: "send_email",
        title: `Send email: ${value(input, "subject") || "Untitled"}`,
        description: previewOf(String(input.body || "")),
        urgency: "normal",
        payload: input,
        reasoning: value(input, "reasoning") || "",
        sourceContext: "admin_ai",
        entityType: "opportunity",
        entityId: value(input, "opportunityId"),
        dedupeKey: `ai-email:${value(input, "to")}:${value(input, "subject")}`.slice(0, 220),
        proposedBy: actorEmail,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    },
  },
  {
    name: "propose_stage_change",
    description: "Stage a pipeline movement for founder approval. Evidence must be included.",
    inputSchema: {
      type: "object",
      properties: {
        opportunityId: { type: "string" },
        stage: { type: "string", enum: [...REVENUE_STAGES] },
        reason: { type: "string" },
        lossReason: { type: "string" },
      },
      required: ["opportunityId", "stage", "reason"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) =>
      proposeAction(supabase, {
        actionType: "transition_opportunity",
        title: `Move opportunity to ${value(input, "stage")}`,
        description: value(input, "reason") || "",
        urgency: "normal",
        payload: input,
        reasoning: value(input, "reason") || "",
        sourceContext: "admin_ai",
        entityType: "opportunity",
        entityId: value(input, "opportunityId"),
        dedupeKey: `ai-stage:${value(input, "opportunityId")}:${value(input, "stage")}`,
        proposedBy: actorEmail,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
  },
  {
    name: "propose_task",
    description: "Stage a concrete operator task for approval.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        dueDate: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        opportunityId: { type: "string" },
      },
      required: ["title", "priority"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) => {
      const dedupeKey =
        `ai-task:${value(input, "opportunityId") || "general"}:${value(input, "title")}`.slice(
          0,
          220,
        );
      return proposeAction(supabase, {
        actionType: "create_task",
        title: value(input, "title") || "Untitled task",
        description: value(input, "description"),
        urgency: input.priority === "high" ? "high" : "normal",
        payload: { ...input, dedupeKey },
        sourceContext: "admin_ai",
        entityType: value(input, "opportunityId") ? "opportunity" : undefined,
        entityId: value(input, "opportunityId"),
        dedupeKey,
        proposedBy: actorEmail,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    },
  },
  {
    name: "propose_campaign_activation",
    description: "Stage activation of a reviewed campaign version for founder approval.",
    inputSchema: {
      type: "object",
      properties: { campaignId: { type: "string" }, reasoning: { type: "string" } },
      required: ["campaignId", "reasoning"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "external_action",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) =>
      proposeAction(supabase, {
        actionType: "activate_campaign",
        title: "Activate reviewed campaign",
        description: value(input, "reasoning") || "",
        urgency: "normal",
        payload: input,
        reasoning: value(input, "reasoning") || "",
        sourceContext: "admin_ai",
        entityType: "campaign",
        entityId: value(input, "campaignId"),
        dedupeKey: `ai-campaign-activate:${value(input, "campaignId")}`,
        proposedBy: actorEmail,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
  },
];

const PACK_TOOL_NAMES: Record<RevenueToolPackId, readonly string[]> = {
  core: ["get_today_snapshot", "search_pipeline", "get_record_timeline", "propose_task"],
  pipeline: [
    "get_today_snapshot",
    "search_pipeline",
    "get_record_timeline",
    "propose_task",
    "propose_stage_change",
  ],
  outreach: [
    "get_today_snapshot",
    "search_pipeline",
    "get_record_timeline",
    "propose_task",
    "propose_send_email",
    "propose_campaign_activation",
  ],
};

export function selectRevenueToolPack(command: string): RevenueToolPackId {
  const normalized = command.toLowerCase();
  if (/\b(email|reply|message|campaign|outreach|follow[ -]?up|send|draft)\b/.test(normalized))
    return "outreach";
  if (/\b(pipeline|opportunit|deal|stage|move|advance|won|lost|risk)\b/.test(normalized))
    return "pipeline";
  return "core";
}

export function getRevenueAiTools(pack?: RevenueToolPackId): AiToolRegistration[] {
  if (!pack) return registry;
  const names = new Set(PACK_TOOL_NAMES[pack]);
  return registry.filter((tool) => names.has(tool.name));
}
export function listRevenueAiCapabilities(
  context?: Pick<AiToolContext, "toolPack">,
): RevenueAiCapabilityDescriptor[] {
  return registry.map((tool) => {
    const availability = availabilityFor(tool, context);
    return {
      name: tool.name,
      description: tool.description,
      impact: tool.impact,
      confirmationRequired: tool.confirmationRequired,
      packs: REVENUE_TOOL_PACKS.filter((pack) => PACK_TOOL_NAMES[pack].includes(tool.name)),
      serviceTarget: tool.serviceTarget,
      connectionRequirement: tool.connectionRequirement,
      available: availability.available,
      availabilityReason: availability.reason,
    };
  });
}
export function toOpenRouterTools(pack?: RevenueToolPackId): OpenRouterTool[] {
  return getRevenueAiTools(pack).map(({ name, description, inputSchema }) => ({
    type: "function",
    function: { name, description, parameters: inputSchema },
  }));
}
export async function executeRegisteredRevenueTool(
  context: AiToolContext,
  name: string,
  input: Record<string, unknown>,
) {
  const tool = registry.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Tool ${name} is not registered`);
  // Destructive work has no reviewed tool or recovery policy yet, so it fails
  // closed at dispatch rather than relying on nobody having written one.
  if (tool.impact === "destructive") {
    throw new Error(
      `${tool.name} is a destructive tool and is not available. Destructive actions require a reviewed tool and a recovery policy.`,
    );
  }
  const availability = availabilityFor(tool, context);
  if (!availability.available)
    throw new Error(`${tool.name} is unavailable: ${availability.reason}`);
  validateToolInput(tool.name, tool.inputSchema, input);
  const output = await tool.execute(context, input);
  validateToolOutput(tool.name, tool.outputSchema, output);
  assertImpactHonoured(tool, output);
  return { output, tool };
}
