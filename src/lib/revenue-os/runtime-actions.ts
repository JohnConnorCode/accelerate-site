import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApprovedTenantWriter, tenantIdForDatabase } from "@/lib/supabase/server";
import {
  storeAgentMemory,
  recordLearnedPolicy,
  type AgentMemoryEntry,
  type LearnedPolicyEntry,
} from "./memory";

function text(
  input: Record<string, unknown>,
  key: string,
  required = false,
  max = 6000,
): string | undefined {
  const value = input[key];
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`Invalid ${key}`);
  return value.trim();
}
function choice(
  input: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  fallback?: string,
): string {
  const value = text(input, key, fallback === undefined) ?? fallback!;
  if (!allowed.includes(value)) throw new Error(`Invalid ${key}`);
  return value;
}

/** Only the action executor calls this service after claim and authorization. */
export async function executeRuntimeAction(
  db: SupabaseClient,
  actionType: string,
  input: Record<string, unknown>,
  actorEmail: string,
) {
  if (actionType === "bootstrap_coworker") {
    // Bootstrapping registers autonomy policies, which only the service role
    // may write. The founder approved this action, so the approved bootstrap
    // gets a tenant-bound administrative writer; no handle escapes to tools.
    const tenantId = tenantIdForDatabase(db);
    if (!tenantId) throw new Error("Coworker bootstrap requires a tenant-bound database");
    const writer = createApprovedTenantWriter(tenantId, "approved-coworker-bootstrap");
    const name = choice(input, "coworker", [
      "sales",
      "business_pulse",
      "meeting_intel",
      "finance",
      "operations",
    ]);
    switch (name) {
      case "sales":
        return (await import("./sales-coworker")).bootstrapSalesCoworker(writer, actorEmail);
      case "business_pulse":
        return (await import("./business-pulse-coworker")).bootstrapBusinessPulseCoworker(
          writer,
          actorEmail,
        );
      case "meeting_intel":
        return (await import("./meeting-intel-coworker")).bootstrapMeetingIntelCoworker(
          writer,
          actorEmail,
        );
      case "finance":
        return (await import("./finance-coworker")).bootstrapFinanceCoworker(writer, actorEmail);
      case "operations":
        return (await import("./operations-coworker")).bootstrapOperationsCoworker(
          writer,
          actorEmail,
        );
    }
  }
  if (actionType === "store_agent_memory")
    return storeAgentMemory(db, {
      category: choice(input, "category", [
        "prior_work",
        "prior_research",
        "scheduled_check",
        "unresolved_question",
      ]) as AgentMemoryEntry["category"],
      subject: text(input, "subject", true, 240)!,
      body: text(input, "body", true)!,
      coworkerId: text(input, "coworkerId"),
      entityType: text(input, "entityType"),
      entityId: text(input, "entityId"),
      relevanceHorizon: choice(
        input,
        "relevanceHorizon",
        ["session", "daily", "weekly", "permanent"],
        "daily",
      ) as AgentMemoryEntry["relevance_horizon"],
      actorEmail,
    });
  if (actionType === "record_learned_policy")
    return recordLearnedPolicy(db, {
      actionKey: text(input, "actionKey", true, 120)!,
      rule: text(input, "rule", true)!,
      rationale: text(input, "rationale", true)!,
      source: choice(input, "source", [
        "human_decision",
        "founder_override",
        "incident_remediation",
        "policy_review",
      ]) as LearnedPolicyEntry["source"],
      coworkerId: text(input, "coworkerId"),
      scopeEntityType: text(input, "scopeEntityType"),
      scopeEntityId: text(input, "scopeEntityId"),
      actorEmail,
    });
  throw new Error("Unknown runtime action");
}
