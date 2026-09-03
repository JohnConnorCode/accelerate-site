import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Budgets (northstar §24)
//
// Autonomous workers require explicit resource constraints. Running out of
// budget should be a normal state — not an error, not a surprise.
//
// Supports per-worker or per-tenant limits:
//   - maximum model spend/day
//   - maximum vendor API calls/day
//   - maximum emails/day
//   - maximum research depth (work item chains)
//   - maximum retry count
//   - maximum runtime (seconds)
//
// Budgets are checked before work execution and decremented after. When a
// budget is exhausted, the work item is skipped with a clear reason rather
// than failing or running uncontrolled.
// ---------------------------------------------------------------------------

export type BudgetKind =
  | "model_spend"
  | "vendor_api_calls"
  | "emails_sent"
  | "research_depth"
  | "retry_count"
  | "runtime_seconds";

export interface BudgetLimit {
  id: string;
  tenant_id: string;
  coworker_id: string | null;
  budget_kind: BudgetKind;
  limit_value: number;
  period: "daily" | "weekly" | "monthly" | "per_work_item";
  created_at: string;
}

export interface BudgetUsage {
  id: string;
  tenant_id: string;
  coworker_id: string | null;
  budget_kind: BudgetKind;
  used_value: number;
  period_key: string;
  created_at: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  budgetKind: BudgetKind;
  used: number;
  limit: number;
  remaining: number;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Check budgets before work execution
// ---------------------------------------------------------------------------

/**
 * Check whether a coworker has remaining budget for a given action.
 * Returns one result per applicable budget limit. If any result has
 * allowed=false, the work should not proceed.
 */
export async function checkBudgets(
  supabase: SupabaseClient,
  input: {
    coworkerId: string;
    budgetKinds?: BudgetKind[];
  },
): Promise<BudgetCheckResult[]> {
  const kinds = input.budgetKinds ?? [
    "model_spend",
    "vendor_api_calls",
    "emails_sent",
    "research_depth",
    "retry_count",
    "runtime_seconds",
  ];
  const today = new Date().toISOString().slice(0, 10);

  // Fetch limits: coworker-specific first, then tenant-global. "*" is the
  // sentinel for tenant-global (see migrations/20260903-agent-memory-and-budgets.sql
  // for why coworker_id is NOT NULL rather than nullable).
  const { data: coworkerLimits } = await supabase
    .from("budget_limits")
    .select()
    .eq("coworker_id", input.coworkerId)
    .in("budget_kind", kinds);

  const { data: globalLimits } = await supabase
    .from("budget_limits")
    .select()
    .eq("coworker_id", "*")
    .in("budget_kind", kinds);

  // Build a map: coworker-specific overrides global.
  const limitMap = new Map<string, BudgetLimit>();
  for (const limit of globalLimits ?? []) {
    limitMap.set(limit.budget_kind, limit as BudgetLimit);
  }
  for (const limit of coworkerLimits ?? []) {
    limitMap.set(limit.budget_kind, limit as BudgetLimit);
  }

  // If no limits exist, everything is allowed.
  if (limitMap.size === 0) {
    return kinds.map((kind) => ({
      allowed: true,
      budgetKind: kind,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      reason: null,
    }));
  }

  // Fetch usage for today.
  const { data: usageRows } = await supabase
    .from("budget_usage")
    .select()
    .eq("coworker_id", input.coworkerId)
    .eq("period_key", today)
    .in("budget_kind", kinds);

  const usageByKind = new Map<string, number>();
  for (const row of usageRows ?? []) {
    usageByKind.set(row.budget_kind, (usageByKind.get(row.budget_kind) ?? 0) + row.used_value);
  }

  const results: BudgetCheckResult[] = [];
  for (const [kind, limit] of limitMap) {
    const used = usageByKind.get(kind) ?? 0;
    const remaining = limit.limit_value - used;
    const allowed = remaining > 0;
    results.push({
      allowed,
      budgetKind: kind as BudgetKind,
      used,
      limit: limit.limit_value,
      remaining,
      reason: allowed ? null : `Budget exhausted: ${kind} (${used}/${limit.limit_value})`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Record budget usage after work execution
// ---------------------------------------------------------------------------

/**
 * Record budget consumption after an action. Upserts into budget_usage
// so the row accumulates within the period.
 */
export async function recordBudgetUsage(
  supabase: SupabaseClient,
  input: {
    coworkerId: string | null;
    budgetKind: BudgetKind;
    value: number;
    actorEmail?: string | null;
  },
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // increment_budget_usage is the only write path — it is atomic (advisory
  // lock + a single upsert-and-add) and normalizes null/"" coworker_id to
  // the "*" tenant-global sentinel. There is deliberately no client-side
  // upsert fallback: that fallback used to OVERWRITE used_value with the
  // delta instead of incrementing it, silently resetting budgets under any
  // concurrent execution. If this RPC call fails, the caller must know.
  const { error: rpcError } = await supabase.rpc("increment_budget_usage", {
    p_coworker_id: input.coworkerId,
    p_budget_kind: input.budgetKind,
    p_period_key: today,
    p_value: input.value,
  });
  if (rpcError) throw new Error(`Failed to record budget usage: ${rpcError.message}`);

  // Check if any budget is now at 90%+ and audit it.
  if (input.coworkerId) {
    const checks = await checkBudgets(supabase, {
      coworkerId: input.coworkerId,
      budgetKinds: [input.budgetKind],
    });
    const nearLimit = checks.find(
      (c) => c.limit > 0 && c.limit < Infinity && c.used / c.limit >= 0.9,
    );
    if (nearLimit) {
      await recordAudit(supabase, {
        actorEmail: input.actorEmail || "system",
        action: "budget.near_limit",
        entityType: "budget",
        entityId: `${input.coworkerId}:${input.budgetKind}`,
        source: "automation",
        after: {
          budgetKind: input.budgetKind,
          used: nearLimit.used,
          limit: nearLimit.limit,
          percentUsed: Math.round((nearLimit.used / nearLimit.limit) * 100),
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Set and list budget limits
// ---------------------------------------------------------------------------

export async function setBudgetLimit(
  supabase: SupabaseClient,
  input: {
    coworkerId?: string | null;
    budgetKind: BudgetKind;
    limitValue: number;
    period?: "daily" | "weekly" | "monthly" | "per_work_item";
    actorEmail?: string | null;
  },
): Promise<BudgetLimit> {
  const period = input.period ?? "daily";
  const { data, error } = await supabase
    .from("budget_limits")
    .upsert(
      {
        coworker_id: input.coworkerId ?? "*",
        budget_kind: input.budgetKind,
        limit_value: input.limitValue,
        period,
      },
      { onConflict: "coworker_id,budget_kind" },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to set budget limit: ${error.message}`);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "budget.limit_set",
    entityType: "budget",
    entityId: data.id,
    source: input.actorEmail ? "admin" : "automation",
    after: {
      budgetKind: input.budgetKind,
      limitValue: input.limitValue,
      period,
      coworkerId: input.coworkerId,
    },
  });

  return data as BudgetLimit;
}

export async function listBudgetLimits(
  supabase: SupabaseClient,
  input?: {
    coworkerId?: string;
    budgetKind?: BudgetKind;
  },
): Promise<BudgetLimit[]> {
  let query = supabase.from("budget_limits").select().order("created_at", { ascending: false });
  if (input?.coworkerId) query = query.eq("coworker_id", input.coworkerId);
  if (input?.budgetKind) query = query.eq("budget_kind", input.budgetKind);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list budget limits: ${error.message}`);
  return (data ?? []) as BudgetLimit[];
}
