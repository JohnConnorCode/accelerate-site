import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenRouterTool } from "@/lib/ai/openrouter";
import { proposeAction } from "./actions";
import { loadOperatorQueue } from "./queue";
import { loadActivityTimeline } from "./activities";
import { ADMIN_LAYOUT_SCOPES, proposeLayoutChange } from "./admin-layout";
import { FOUNDER_NOTE_MAX_LENGTH } from "./notes";
import { retrieveKnowledge } from "./knowledge";
import { isAiToolModuleEnabled } from "./modules";
import { listClaimableWork, type WorkItem } from "./work-items";
import { listWorkspaceCapabilities, type WorkspaceCapability } from "./capabilities";
import { listClaimsForEntity, type Claim } from "./claims";
import { listAutonomyPolicies, type AutonomyPolicy } from "./autonomy-policy";
import { listCoworkers, type Coworker } from "./coworkers";
import { listPlugins, type Plugin } from "./plugins";
import { getAgentActivityForEntity, type AgentActivityEntry } from "./agent-activity";
import { bootstrapSalesCoworker } from "./sales-coworker";
import { bootstrapBusinessPulseCoworker } from "./business-pulse-coworker";
import { bootstrapMeetingIntelCoworker } from "./meeting-intel-coworker";
import { bootstrapFinanceCoworker } from "./finance-coworker";
import { bootstrapOperationsCoworker } from "./operations-coworker";
import { queryMemory, storeAgentMemory, retrieveAgentMemory, listLearnedPolicies, recordLearnedPolicy, MEMORY_CATEGORIES, type AgentMemoryEntry, type LearnedPolicyEntry, type MemoryCategory } from "./memory";
import { checkBudgets, listBudgetLimits, type BudgetKind, type BudgetLimit } from "./budgets";

export const AI_TOOL_REGISTRY_VERSION = "revenue-os-tools.v4";
export const REVENUE_TOOL_PACKS = ["core", "pipeline", "outreach"] as const;
export type RevenueToolPackId = (typeof REVENUE_TOOL_PACKS)[number];

/** How many rows any single snapshot query may read. */
const SNAPSHOT_ROW_LIMIT = 50;
/** How many of those are returned in full to the model. */
const SNAPSHOT_DETAIL_LIMIT = 10;
export type AiToolImpact = "read" | "internal_write" | "external_action" | "destructive";
type AiToolContext = {
  supabase: SupabaseClient;
  actorEmail: string;
  toolPack?: RevenueToolPackId;
  tenantConfig?: { modules?: Partial<Record<string, boolean>> } | null;
};
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
const KNOWLEDGE_OUTPUT_SCHEMA = {
  type: "object",
  required: ["contract", "found", "query", "chunks", "generatedAt"],
  properties: {
    contract: { type: "string" },
    found: { type: "boolean" },
    query: { type: "string" },
    entitySummary: { type: "object" },
    chunks: { type: "array" },
    refusalReason: { type: "string" },
    generatedAt: { type: "string" },
  },
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
  context?: Pick<AiToolContext, "toolPack" | "tenantConfig">,
): { available: boolean; reason: string } {
  if (context?.toolPack && !PACK_TOOL_NAMES[context.toolPack].includes(tool.name)) {
    return {
      available: false,
      reason: `${tool.name} is not available in the ${context.toolPack} tool pack.`,
    };
  }
  const moduleCheck = isAiToolModuleEnabled(tool.name, context?.tenantConfig);
  if (!moduleCheck.enabled) {
    return {
      available: false,
      reason:
        moduleCheck.reason ?? `${tool.name} module is disabled in this workspace configuration.`,
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
        stage: {
          type: "string",
          description:
            "A pipeline stage's column_key (workspace-defined, not a fixed set — check get_record_timeline/prior tool results for real values rather than guessing).",
        },
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
      if (typeof input.stage === "string" && input.stage.trim())
        builder = builder.eq("stage", input.stage.trim());
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
    name: "search_knowledge_base",
    description:
      "Query grounded knowledge with provenance across companies, contacts, opportunities, founder notes, and activity timeline. Returns tagged chunks with confidence and recency or refuses cleanly.",
    inputSchema: {
      type: "object",
      properties: {
        entityName: { type: "string" },
        email: { type: "string" },
        domain: { type: "string" },
        topic: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    outputSchema: KNOWLEDGE_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.knowledge-retrieval",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) =>
      retrieveKnowledge(supabase, {
        entityName: value(input, "entityName"),
        email: value(input, "email"),
        domain: value(input, "domain"),
        topic: value(input, "topic"),
        limit: typeof input.limit === "number" ? input.limit : undefined,
      }),
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
    name: "propose_founder_note",
    description:
      "Stage a founder note for approval. Once approved it is saved as an immutable timeline entry, optionally attached to a contact, company, or opportunity.",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", maxLength: FOUNDER_NOTE_MAX_LENGTH },
        contactId: { type: "string" },
        companyId: { type: "string" },
        opportunityId: { type: "string" },
        reasoning: { type: "string" },
      },
      required: ["body"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) => {
      const body = value(input, "body");
      if (!body) throw new Error("body is required");
      const firstLine = body.split(/\r?\n/, 1)[0]?.trim() || "Founder note";
      const title = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
      const contactId = value(input, "contactId");
      const companyId = value(input, "companyId");
      const opportunityId = value(input, "opportunityId");
      return proposeAction(supabase, {
        actionType: "create_founder_note",
        title,
        description: value(input, "reasoning"),
        urgency: "low",
        payload: { body, contactId, companyId, opportunityId },
        reasoning: value(input, "reasoning"),
        sourceContext: "admin_ai",
        entityType: opportunityId ? "opportunity" : contactId ? "contact" : undefined,
        entityId: opportunityId || contactId,
        dedupeKey: `ai-note:${opportunityId || contactId || companyId || "standalone"}:${body.slice(0, 80)}`,
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
        stage: {
          type: "string",
          description:
            "The target pipeline stage's column_key (workspace-defined — use the opportunity's own record or search_pipeline results, never guess).",
        },
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
    execute: async ({ supabase, actorEmail }, input) => {
      const oppId = value(input, "opportunityId");
      let expectedStage: string | undefined;
      if (oppId) {
        const { data: currentOpp } = await supabase
          .from("opportunities")
          .select("stage")
          .eq("id", oppId)
          .maybeSingle();
        if (currentOpp?.stage) expectedStage = currentOpp.stage;
      }
      return proposeAction(supabase, {
        actionType: "transition_opportunity",
        title: `Move opportunity to ${value(input, "stage")}`,
        description: value(input, "reason") || "",
        urgency: "normal",
        payload: { ...input, expectedStage },
        reasoning: value(input, "reason") || "",
        sourceContext: "admin_ai",
        entityType: "opportunity",
        entityId: oppId,
        dedupeKey: `ai-stage:${oppId}:${value(input, "stage")}`,
        proposedBy: actorEmail,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    },
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
    name: "propose_task_update",
    description:
      "Stage a change to an existing task for approval: mark it complete, snooze it to a later date, or edit its title, priority, or due date. Never changes the task directly; the founder approves it from the review queue like every other proposal.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description:
            'The task id, either bare or in the "task:<id>" form get_today_snapshot returns in its queue.',
        },
        changeType: { type: "string", enum: ["complete", "snooze", "edit"] },
        until: {
          type: "string",
          description: "Snooze target date (YYYY-MM-DD), required when changeType is snooze.",
        },
        title: { type: "string", description: "New title, only used when changeType is edit." },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        dueDate: {
          type: "string",
          description: "New due date (YYYY-MM-DD), or an empty string to clear it.",
        },
      },
      required: ["taskId", "changeType"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) => {
      const taskId = (value(input, "taskId") || "").replace(/^task:/, "");
      if (!taskId) throw new Error("taskId is required");
      const changeType = value(input, "changeType");
      if (!changeType || !["complete", "snooze", "edit"].includes(changeType))
        throw new Error('changeType must be "complete", "snooze", or "edit"');
      if (changeType === "snooze" && !value(input, "until"))
        throw new Error('changeType "snooze" requires "until"');
      if (
        changeType === "edit" &&
        !value(input, "title") &&
        !value(input, "priority") &&
        input.dueDate === undefined
      )
        throw new Error('changeType "edit" requires at least one of title, priority, or dueDate');
      const dedupeKey = `ai-task-update:${taskId}:${changeType}:${Date.now()}`;
      const title =
        changeType === "complete"
          ? "Mark task complete"
          : changeType === "snooze"
            ? `Snooze task to ${value(input, "until")}`
            : "Edit task";
      return proposeAction(supabase, {
        actionType: "update_task",
        title,
        description: value(input, "title") ? `New title: ${value(input, "title")}` : undefined,
        urgency: "normal",
        payload: {
          taskId,
          changeType,
          until: value(input, "until"),
          title: value(input, "title"),
          priority: value(input, "priority"),
          dueDate: input.dueDate === "" ? null : value(input, "dueDate"),
        },
        sourceContext: "admin_ai",
        entityType: "task",
        entityId: taskId,
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
    execute: async ({ supabase, actorEmail }, input) => {
      const campaignId = value(input, "campaignId");
      let expectedVersion: number | undefined;
      if (campaignId) {
        const { data: currentCamp } = await supabase
          .from("campaigns")
          .select("version")
          .eq("id", campaignId)
          .maybeSingle();
        if (typeof currentCamp?.version === "number") expectedVersion = currentCamp.version;
      }
      return proposeAction(supabase, {
        actionType: "activate_campaign",
        title: "Activate reviewed campaign",
        description: value(input, "reasoning") || "",
        urgency: "normal",
        payload: { ...input, expectedVersion },
        reasoning: value(input, "reasoning") || "",
        sourceContext: "admin_ai",
        entityType: "campaign",
        entityId: campaignId,
        dedupeKey: `ai-campaign-activate:${campaignId}`,
        proposedBy: actorEmail,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    },
  },
  {
    name: "propose_layout_change",
    description:
      "Stage a reorder or show/hide change to a bounded admin layout region (sidebar navigation or the Today page) for founder approval. Only known ids for the given scope may be referenced; required regions can never be hidden.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ADMIN_LAYOUT_SCOPES.map((scope) => scope.id) },
        order: { type: "array", items: { type: "string" } },
        hidden: { type: "array", items: { type: "string" } },
        reasoning: { type: "string" },
      },
      required: ["scope", "reasoning"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) =>
      proposeLayoutChange(supabase, {
        scope: String(input.scope ?? ""),
        doc: { order: input.order ?? [], hidden: input.hidden ?? [] },
        actorEmail,
        reasoning: value(input, "reasoning"),
      }),
  },
  {
    name: "search_contacts",
    description: "Search contacts and associated company details by name, email, or phone.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.contact-search",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const query = (value(input, "query") || "").replace(/[,%]/g, "");
      const email = value(input, "email");
      const phone = value(input, "phone");
      let builder = supabase
        .from("contacts")
        .select("id,full_name,primary_email,phone,title,company_id,created_at")
        .limit(25);
      if (email) {
        builder = builder.ilike("primary_email", `%${email}%`);
      } else if (phone) {
        builder = builder.ilike("phone", `%${phone}%`);
      } else if (query) {
        builder = builder.or(`full_name.ilike.%${query}%,primary_email.ilike.%${query}%`);
      }
      const { data, error } = await builder;
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.full_name,
        email: row.primary_email,
        phone: row.phone,
        title: row.title,
        companyId: row.company_id,
        createdAt: row.created_at,
      }));
    },
  },
  {
    name: "search_conversations",
    description: "Search omnichannel conversations and inbound messages by status or unread state.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "resolved", "archived"] },
        unreadOnly: { type: "boolean" },
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.conversations-search",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      let builder = supabase
        .from("conversations")
        .select("id,subject,channel,status,unread_count,last_message_at,contact_id,opportunity_id")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(25);
      if (typeof input.status === "string") {
        builder = builder.eq("status", input.status);
      }
      if (input.unreadOnly === true) {
        builder = builder.gt("unread_count", 0);
      }
      const { data, error } = await builder;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  },
  {
    name: "get_pending_actions",
    description: "List pending proposals currently in the action_queue awaiting founder review.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }) => {
      const { data, error } = await supabase
        .from("action_queue")
        .select("id,action_type,title,description,urgency,reasoning,created_at,expires_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  },
  {
    name: "get_claimable_work",
    description:
      "List work items that are ready to be claimed and executed. Returns pending or waiting items past their next_check_at, ordered by priority and age.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", description: "Filter to a specific work-item kind" },
        limit: { type: "number", description: "Max items to return (default 20)" },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.work-engine-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const limitStr = value(input, "limit");
      const items = await listClaimableWork(supabase, {
        kind: value(input, "kind") ?? undefined,
        limit: limitStr ? Number(limitStr) : undefined,
      });
      return items.map((wi: WorkItem) => ({
        id: wi.id,
        kind: wi.kind,
        objective: wi.objective,
        priority: wi.priority,
        status: wi.status,
        reason: wi.reason,
        source: wi.source,
        entity_type: wi.entity_type,
        entity_id: wi.entity_id,
        due_at: wi.due_at,
        next_check_at: wi.next_check_at,
        next_check_reason: wi.next_check_reason,
        attempt_count: wi.attempt_count,
        max_attempts: wi.max_attempts,
        created_at: wi.created_at,
      }));
    },
  },
  {
    name: "get_workspace_capabilities",
    description:
      "List the capabilities available in this workspace. Shows which integrations, runtime features, and plugin capabilities are enabled, their policy (automatic/approval_required/prohibited), and last verification time.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter to a category: integration, runtime, plugin, or system",
        },
        availableOnly: { type: "boolean", description: "Only return available capabilities" },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.capability-graph-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const categoryVal = value(input, "category");
      const availableOnlyVal = value(input, "availableOnly");
      const capabilities = await listWorkspaceCapabilities(supabase, {
        category: categoryVal
          ? (["integration", "runtime", "plugin", "system"].includes(categoryVal)
              ? (categoryVal as "integration" | "runtime" | "plugin" | "system")
              : undefined)
          : undefined,
        availableOnly: availableOnlyVal === "true",
      });
      return capabilities.map((cap: WorkspaceCapability) => ({
        capability_key: cap.capability_key,
        label: cap.label,
        category: cap.category,
        direction: cap.direction,
        impact: cap.impact,
        available: cap.available,
        policy: cap.policy,
        status_reason: cap.status_reason,
        verified_at: cap.verified_at,
      }));
    },
  },
  {
    name: "get_claims_for_entity",
    description:
      "List evidence-backed claims for a business entity. Shows what the system believes about a contact, company, or opportunity, the evidence supporting each claim, and its verification status (unverified/supported/verified/conflicted).",
    inputSchema: {
      type: "object",
      properties: {
        entityType: {
          type: "string",
          description: "Entity type: contact, company, opportunity, etc.",
        },
        entityId: { type: "string", description: "The entity's UUID" },
        status: {
          type: "string",
          description: "Comma-separated claim statuses to filter: unverified,supported,conflicted,verified",
        },
      },
      required: ["entityType", "entityId"],
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.claims-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const entityType = value(input, "entityType")!;
      const entityId = value(input, "entityId")!;
      const statusStr = value(input, "status");
      const statuses = statusStr
        ? (statusStr.split(",").map((s) => s.trim()).filter(Boolean) as Claim["status"][])
        : undefined;
      const claims = await listClaimsForEntity(supabase, {
        entityType,
        entityId,
        status: statuses,
      });
      return claims.map((c: Claim) => ({
        id: c.id,
        field: c.field,
        proposed_value: c.proposed_value,
        status: c.status,
        best_evidence: c.best_evidence,
        source_type: c.source_type,
        created_at: c.created_at,
        resolved_at: c.resolved_at,
      }));
    },
  },
  {
    name: "get_autonomy_policies",
    description:
      "List the autonomy policies governing agent actions. Shows the five-level ladder (prohibited→autonomous) for each action, hard safety floors, and standing permissions.",
    inputSchema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          description: "Filter to a specific level: prohibited, always_ask, ask_until_trusted, standing_permission, autonomous",
        },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.autonomy-policy-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const levelVal = value(input, "level");
      const policies = await listAutonomyPolicies(supabase, {
        level: levelVal
          ? (["prohibited", "always_ask", "ask_until_trusted", "standing_permission", "autonomous"].includes(levelVal)
              ? (levelVal as "prohibited" | "always_ask" | "ask_until_trusted" | "standing_permission" | "autonomous")
              : undefined)
          : undefined,
      });
      return policies.map((p: AutonomyPolicy) => ({
        action_key: p.action_key,
        label: p.label,
        level: p.level,
        is_hard_floor: p.is_hard_floor,
        coworker_id: p.coworker_id,
        approved_by: p.approved_by,
        constraints: p.constraints,
      }));
    },
  },
  {
    name: "get_coworkers",
    description:
      "List registered coworkers and their capabilities. Shows each coworker's identity, role, required capabilities, work kinds, and readiness status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter to a status: active, paused, disabled",
        },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.coworkers-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const statusVal = value(input, "status");
      const coworkers = await listCoworkers(supabase, {
        status: statusVal
          ? (["active", "paused", "disabled"].includes(statusVal)
              ? (statusVal as "active" | "paused" | "disabled")
              : undefined)
          : undefined,
      });
      return coworkers.map((cw: Coworker) => ({
        id: cw.id,
        name: cw.name,
        role: cw.role,
        status: cw.status,
        tool_pack: cw.tool_pack,
        required_capabilities: cw.required_capabilities,
        work_kinds: cw.work_kinds,
      }));
    },
  },
  {
    name: "get_agent_activity_for_entity",
    description:
      "Get a readable agent activity timeline for a business entity. Shows what autonomous work has happened, what's in progress, what's waiting, and what's scheduled next. Not a raw audit dump — designed to make autonomous work understandable to a normal operator.",
    inputSchema: {
      type: "object",
      properties: {
        entityType: {
          type: "string",
          description: "Entity type: contact, company, opportunity",
        },
        entityId: { type: "string", description: "The entity's UUID" },
      },
      required: ["entityType", "entityId"],
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.agent-activity-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const entityType = value(input, "entityType")!;
      const entityId = value(input, "entityId")!;
      const timeline = await getAgentActivityForEntity(supabase, {
        entityType,
        entityId,
        limit: 20,
      });
      return timeline.entries.map((e: AgentActivityEntry) => ({
        timestamp: e.timestamp,
        source: e.source,
        action: e.action,
        summary: e.summary,
        status: e.status,
        coworker_id: e.coworkerId,
      }));
    },
  },
  {
    name: "get_plugins",
    description:
      "List registered plugins and their status. Shows what integrations and extensions are installed, their capabilities, tools, and triggers.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter to a status: pending_review, approved, enabled, disabled, revoked",
        },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.plugins-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const statusVal = value(input, "status");
      const plugins = await listPlugins(supabase, {
        status: statusVal
          ? (["pending_review", "approved", "enabled", "disabled", "revoked"].includes(statusVal)
              ? (statusVal as "pending_review" | "approved" | "enabled" | "disabled" | "revoked")
              : undefined)
          : undefined,
      });
      return plugins.map((p: Plugin) => ({
        plugin_key: p.plugin_key,
        name: p.name,
        description: p.description,
        version: p.version,
        status: p.status,
        required_capabilities: p.required_capabilities,
        mcp_server_url: p.mcp_server_url,
      }));
    },
  },
  {
    name: "bootstrap_sales_coworker",
    description:
      "Bootstrap the Sales Coworker: register its capabilities, autonomy policies, and work kinds. Returns readiness status and any capability gaps. Idempotent — safe to call multiple times.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "object",
      required: ["readyToWork", "capabilityGaps"],
      properties: {
        readyToWork: { type: "boolean" },
        capabilityGaps: { type: "array", items: { type: "string" } },
      },
    },
    serviceTarget: "revenue-os.coworker-bootstrap",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }) => {
      const result = await bootstrapSalesCoworker(supabase, actorEmail);
      return {
        readyToWork: result.readyToWork,
        capabilityGaps: result.capabilityGaps,
        coworkerName: result.coworker.name,
      };
    },
  },
  {
    name: "bootstrap_business_pulse_coworker",
    description:
      "Bootstrap the Business Pulse Coworker: register its capabilities, autonomy policies, and work kinds. Monitors pipeline health, detects anomalies, and produces daily digests. Idempotent.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "object",
      required: ["readyToWork", "capabilityGaps"],
      properties: {
        readyToWork: { type: "boolean" },
        capabilityGaps: { type: "array", items: { type: "string" } },
      },
    },
    serviceTarget: "revenue-os.coworker-bootstrap",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }) => {
      const result = await bootstrapBusinessPulseCoworker(supabase, actorEmail);
      return {
        readyToWork: result.readyToWork,
        capabilityGaps: result.capabilityGaps,
        coworkerName: result.coworker.name,
      };
    },
  },
  {
    name: "bootstrap_meeting_intel_coworker",
    description:
      "Bootstrap the Meeting Intelligence Coworker: register its capabilities, autonomy policies, and work kinds. Generates pre-call briefs and processes post-meeting outcomes. Idempotent.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "object",
      required: ["readyToWork", "capabilityGaps"],
      properties: {
        readyToWork: { type: "boolean" },
        capabilityGaps: { type: "array", items: { type: "string" } },
      },
    },
    serviceTarget: "revenue-os.coworker-bootstrap",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }) => {
      const result = await bootstrapMeetingIntelCoworker(supabase, actorEmail);
      return {
        readyToWork: result.readyToWork,
        capabilityGaps: result.capabilityGaps,
        coworkerName: result.coworker.name,
      };
    },
  },
  {
    name: "bootstrap_finance_coworker",
    description:
      "Bootstrap the Finance Coworker: register its capabilities, autonomy policies, and work kinds. Tracks revenue, monitors payment patterns, and reconciles financial records. Idempotent.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "object",
      required: ["readyToWork", "capabilityGaps"],
      properties: {
        readyToWork: { type: "boolean" },
        capabilityGaps: { type: "array", items: { type: "string" } },
      },
    },
    serviceTarget: "revenue-os.coworker-bootstrap",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }) => {
      const result = await bootstrapFinanceCoworker(supabase, actorEmail);
      return {
        readyToWork: result.readyToWork,
        capabilityGaps: result.capabilityGaps,
        coworkerName: result.coworker.name,
      };
    },
  },
  {
    name: "bootstrap_operations_coworker",
    description:
      "Bootstrap the Operations Coworker: register its capabilities, autonomy policies, and work kinds. Monitors system health, integration status, data quality, and operational anomalies. Idempotent.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "object",
      required: ["readyToWork", "capabilityGaps"],
      properties: {
        readyToWork: { type: "boolean" },
        capabilityGaps: { type: "array", items: { type: "string" } },
      },
    },
    serviceTarget: "revenue-os.coworker-bootstrap",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }) => {
      const result = await bootstrapOperationsCoworker(supabase, actorEmail);
      return {
        readyToWork: result.readyToWork,
        capabilityGaps: result.capabilityGaps,
        coworkerName: result.coworker.name,
      };
    },
  },
  {
    name: "query_memory",
    description:
      "Query across all five memory categories (canonical, activity, knowledge, agent, learned_policy) without collapsing them. Each category retains its own shape. Use this when you need a complete picture of what the system knows about an entity, action, or topic.",
    inputSchema: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: { type: "string", enum: ["canonical", "activity", "knowledge", "agent", "learned_policy"] },
          description: "Which categories to query. Defaults to all.",
        },
        entityType: { type: "string", description: "Entity type to scope (contact, company, opportunity)" },
        entityId: { type: "string", description: "Entity UUID to scope" },
        query: { type: "string", description: "Free-text search (used by knowledge category)" },
        coworkerId: { type: "string", description: "Coworker to scope agent memory" },
        actionKey: { type: "string", description: "Action key to scope learned policies" },
        limit: { type: "number", description: "Max items per category (default 10)" },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.memory-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const categoryStrs = input.categories as string[] | undefined;
      const categories = categoryStrs
        ? (categoryStrs.filter((c): c is MemoryCategory => MEMORY_CATEGORIES.includes(c as MemoryCategory)))
        : undefined;
      const results = await queryMemory(supabase, {
        categories,
        entityType: value(input, "entityType"),
        entityId: value(input, "entityId"),
        query: value(input, "query"),
        coworkerId: value(input, "coworkerId"),
        actionKey: value(input, "actionKey"),
        limit: typeof input.limit === "number" ? input.limit : undefined,
      });
      return results.map((r) => ({
        category: r.category,
        itemCount: r.items.length,
        truncated: r.truncated,
        items: r.items,
      }));
    },
  },
  {
    name: "store_agent_memory",
    description:
      "Store agent-specific context: prior work results, research findings, unresolved questions, or scheduled check reminders. This is agent memory, not canonical data — it decays over time based on the relevance horizon.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["prior_work", "prior_research", "scheduled_check", "unresolved_question"] },
        subject: { type: "string" },
        body: { type: "string" },
        coworkerId: { type: "string" },
        entityType: { type: "string" },
        entityId: { type: "string" },
        relevanceHorizon: { type: "string", enum: ["session", "daily", "weekly", "permanent"] },
      },
      required: ["category", "subject", "body"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      required: ["id", "category", "subject"],
      properties: {
        id: { type: "string" },
        category: { type: "string" },
        subject: { type: "string" },
        relevanceHorizon: { type: "string" },
      },
    },
    serviceTarget: "revenue-os.memory-write",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) => {
      const entry = await storeAgentMemory(supabase, {
        coworkerId: value(input, "coworkerId"),
        category: value(input, "category") as AgentMemoryEntry["category"],
        subject: value(input, "subject")!,
        body: value(input, "body")!,
        entityType: value(input, "entityType"),
        entityId: value(input, "entityId"),
        relevanceHorizon: value(input, "relevanceHorizon") as AgentMemoryEntry["relevance_horizon"],
        actorEmail,
      });
      return { id: entry.id, category: entry.category, subject: entry.subject, relevanceHorizon: entry.relevance_horizon };
    },
  },
  {
    name: "get_agent_memory",
    description:
      "Retrieve agent memory entries — prior work, research, scheduled checks, or unresolved questions. Returns non-expired entries ordered by recency.",
    inputSchema: {
      type: "object",
      properties: {
        coworkerId: { type: "string" },
        category: { type: "string", enum: ["prior_work", "prior_research", "scheduled_check", "unresolved_question"] },
        entityType: { type: "string" },
        entityId: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.memory-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const categoryVal = value(input, "category");
      const entries = await retrieveAgentMemory(supabase, {
        coworkerId: value(input, "coworkerId"),
        category: categoryVal as AgentMemoryEntry["category"] | undefined,
        entityType: value(input, "entityType"),
        entityId: value(input, "entityId"),
        limit: typeof input.limit === "number" ? input.limit : undefined,
      });
      return entries.map((e: AgentMemoryEntry) => ({
        id: e.id,
        category: e.category,
        subject: e.subject,
        body: e.body,
        coworker_id: e.coworker_id,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        relevance_horizon: e.relevance_horizon,
        created_at: e.created_at,
        expires_at: e.expires_at,
      }));
    },
  },
  {
    name: "get_learned_policies",
    description:
      "List active learned policies — explicit rules derived from human decisions. These are the \"don't do X\" and \"always ask before Y\" rules from operational experience.",
    inputSchema: {
      type: "object",
      properties: {
        actionKey: { type: "string", description: "Filter to a specific action key" },
        coworkerId: { type: "string" },
        scopeEntityType: { type: "string" },
        scopeEntityId: { type: "string" },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.memory-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const policies = await listLearnedPolicies(supabase, {
        actionKey: value(input, "actionKey"),
        coworkerId: value(input, "coworkerId"),
        scopeEntityType: value(input, "scopeEntityType"),
        scopeEntityId: value(input, "scopeEntityId"),
      });
      return policies.map((p: LearnedPolicyEntry) => ({
        id: p.id,
        action_key: p.action_key,
        rule: p.rule,
        rationale: p.rationale,
        source: p.source,
        coworker_id: p.coworker_id,
        scope_entity_type: p.scope_entity_type,
        scope_entity_id: p.scope_entity_id,
        created_at: p.created_at,
      }));
    },
  },
  {
    name: "record_learned_policy",
    description:
      "Record a learned policy — an explicit rule derived from a human decision. These capture operational wisdom like \"never auto-advance deals above $50k\" or \"always ask before emailing C-level contacts\". Supersedes any previous active policy for the same action and scope.",
    inputSchema: {
      type: "object",
      properties: {
        actionKey: { type: "string" },
        rule: { type: "string" },
        rationale: { type: "string" },
        source: { type: "string", enum: ["human_decision", "founder_override", "incident_remediation", "policy_review"] },
        coworkerId: { type: "string" },
        scopeEntityType: { type: "string" },
        scopeEntityId: { type: "string" },
      },
      required: ["actionKey", "rule", "rationale", "source"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      required: ["id", "actionKey", "rule"],
      properties: {
        id: { type: "string" },
        actionKey: { type: "string" },
        rule: { type: "string" },
        source: { type: "string" },
      },
    },
    serviceTarget: "revenue-os.memory-write",
    connectionRequirement: "none",
    impact: "internal_write",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) => {
      const entry = await recordLearnedPolicy(supabase, {
        actionKey: value(input, "actionKey")!,
        rule: value(input, "rule")!,
        rationale: value(input, "rationale")!,
        source: value(input, "source") as LearnedPolicyEntry["source"],
        coworkerId: value(input, "coworkerId"),
        scopeEntityType: value(input, "scopeEntityType"),
        scopeEntityId: value(input, "scopeEntityId"),
        actorEmail,
      });
      return { id: entry.id, actionKey: entry.action_key, rule: entry.rule, source: entry.source };
    },
  },
  {
    name: "check_budgets",
    description:
      "Check whether a coworker has remaining budget for work execution. Shows current usage vs limits for model spend, API calls, emails, research depth, retries, and runtime. Budgets are per-day by default.",
    inputSchema: {
      type: "object",
      properties: {
        coworkerId: { type: "string", description: "Coworker to check budgets for" },
      },
      required: ["coworkerId"],
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.budgets-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const results = await checkBudgets(supabase, {
        coworkerId: value(input, "coworkerId")!,
      });
      return results.map((r) => ({
        budget_kind: r.budgetKind,
        allowed: r.allowed,
        used: r.used,
        limit: r.limit,
        remaining: r.remaining,
        reason: r.reason,
      }));
    },
  },
  {
    name: "get_budget_limits",
    description:
      "List budget limits configured for coworkers or globally. Shows the spending/action caps that constrain autonomous work.",
    inputSchema: {
      type: "object",
      properties: {
        coworkerId: { type: "string" },
        budgetKind: { type: "string", enum: ["model_spend", "vendor_api_calls", "emails_sent", "research_depth", "retry_count", "runtime_seconds"] },
      },
      additionalProperties: false,
    },
    outputSchema: ARRAY_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.budgets-read",
    connectionRequirement: "none",
    impact: "read",
    confirmationRequired: false,
    execute: async ({ supabase }, input) => {
      const limits = await listBudgetLimits(supabase, {
        coworkerId: value(input, "coworkerId"),
        budgetKind: value(input, "budgetKind") as BudgetKind | undefined,
      });
      return limits.map((l: BudgetLimit) => ({
        id: l.id,
        coworker_id: l.coworker_id,
        budget_kind: l.budget_kind,
        limit_value: l.limit_value,
        period: l.period,
      }));
    },
  },
  {
    name: "propose_conversation_reply",
    description:
      "Stage a reply to an active conversation thread for founder approval. This never sends directly.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        body: { type: "string" },
        reasoning: { type: "string" },
      },
      required: ["conversationId", "body", "reasoning"],
      additionalProperties: false,
    },
    outputSchema: ACTION_OUTPUT_SCHEMA,
    serviceTarget: "revenue-os.action-queue",
    connectionRequirement: "none",
    impact: "external_action",
    confirmationRequired: true,
    execute: async ({ supabase, actorEmail }, input) => {
      const conversationId = value(input, "conversationId")!;
      const body = value(input, "body")!;
      const reasoning = value(input, "reasoning") || "";
      const { data: conv } = await supabase
        .from("conversations")
        .select("id,subject,channel")
        .eq("id", conversationId)
        .maybeSingle();

      return proposeAction(supabase, {
        actionType: "send_gmail_reply",
        title: `Reply to: ${conv?.subject || "Conversation"}`,
        description: previewOf(body),
        urgency: "normal",
        payload: { conversationId, body, reasoning },
        reasoning,
        sourceContext: "admin_ai",
        entityType: "conversation",
        entityId: conversationId,
        dedupeKey: `ai-reply:${conversationId}:${body.slice(0, 80)}`,
        proposedBy: actorEmail,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    },
  },
];

const PACK_TOOL_NAMES: Record<RevenueToolPackId, readonly string[]> = {
  core: [
    "get_today_snapshot",
    "search_pipeline",
    "search_contacts",
    "get_pending_actions",
    "get_claimable_work",
    "get_workspace_capabilities",
    "get_claims_for_entity",
    "get_autonomy_policies",
    "get_coworkers",
    "get_agent_activity_for_entity",
    "get_plugins",
    "bootstrap_sales_coworker",
    "bootstrap_business_pulse_coworker",
    "bootstrap_meeting_intel_coworker",
    "bootstrap_finance_coworker",
    "bootstrap_operations_coworker",
    "get_record_timeline",
    "search_knowledge_base",
    "query_memory",
    "store_agent_memory",
    "get_agent_memory",
    "get_learned_policies",
    "record_learned_policy",
    "check_budgets",
    "get_budget_limits",
    "propose_task",
    "propose_task_update",
    "propose_layout_change",
    "propose_founder_note",
  ],
  pipeline: [
    "get_today_snapshot",
    "search_pipeline",
    "search_contacts",
    "get_pending_actions",
    "get_claimable_work",
    "get_workspace_capabilities",
    "get_claims_for_entity",
    "get_autonomy_policies",
    "get_coworkers",
    "get_agent_activity_for_entity",
    "get_plugins",
    "get_record_timeline",
    "search_knowledge_base",
    "query_memory",
    "get_agent_memory",
    "get_learned_policies",
    "check_budgets",
    "get_budget_limits",
    "propose_task",
    "propose_task_update",
    "propose_stage_change",
  ],
  outreach: [
    "get_today_snapshot",
    "search_pipeline",
    "search_contacts",
    "search_conversations",
    "get_pending_actions",
    "get_claimable_work",
    "get_workspace_capabilities",
    "get_claims_for_entity",
    "get_autonomy_policies",
    "get_coworkers",
    "get_agent_activity_for_entity",
    "get_plugins",
    "get_record_timeline",
    "search_knowledge_base",
    "query_memory",
    "get_agent_memory",
    "get_learned_policies",
    "check_budgets",
    "get_budget_limits",
    "propose_task",
    "propose_task_update",
    "propose_send_email",
    "propose_conversation_reply",
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
