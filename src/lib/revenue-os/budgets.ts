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
    workItemId?: string;
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
  const { data: limits, error: limitsError } = await supabase
    .from("budget_limits")
    .select("*")
    .in("coworker_id", [...new Set([input.coworkerId, "*"])])
    .in("budget_kind", kinds);
  if (limitsError) throw new Error(`Budget limits unavailable: ${limitsError.message}`);
  if (!limits?.length)
    return kinds.map((budgetKind) => ({
      allowed: true,
      budgetKind,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      reason: null,
    }));
  const starts = limits.map((limit: BudgetLimit) => budgetPeriodStart(limit.period, today));
  const earliest = starts.reduce((a, b) => (a < b ? a : b), today);
  // Global limits constrain the whole tenant, while coworker limits additionally
  // constrain that worker. Worker limits never override a tenant-wide cap.
  const { data: usage, error: usageError } = await supabase
    .from("budget_usage")
    .select("coworker_id,budget_kind,used_value,period_key")
    .in("budget_kind", kinds)
    .gte("period_key", earliest)
    .lte("period_key", today);
  if (usageError) throw new Error(`Budget usage unavailable: ${usageError.message}`);
  let workUsage: Pick<BudgetUsage, "coworker_id" | "budget_kind" | "used_value">[] = [];
  if (limits.some((limit: BudgetLimit) => limit.period === "per_work_item")) {
    if (!input.workItemId) throw new Error("Per-work-item budget requires work context");
    const { data, error } = await supabase
      .from("budget_receipts")
      .select("coworker_id,budget_kind,amount")
      .eq("work_item_id", input.workItemId)
      .in("budget_kind", kinds);
    if (error) throw new Error(`Budget receipts unavailable: ${error.message}`);
    workUsage = (data ?? []).map((row) => ({ ...row, used_value: row.amount }));
  }
  return limits.map((limit: BudgetLimit, index: number) => {
    const rows =
      limit.period === "per_work_item"
        ? workUsage
        : (usage ?? []).filter((row) => row.period_key >= starts[index]!);
    const used = rows
      .filter(
        (row) =>
          row.budget_kind === limit.budget_kind &&
          (limit.coworker_id === "*" || row.coworker_id === input.coworkerId),
      )
      .reduce((sum, row) => sum + Number(row.used_value), 0);
    const cap = Number(limit.limit_value);
    if (!Number.isFinite(used) || !Number.isFinite(cap) || used < 0 || cap < 0)
      throw new Error("Budget accounting is invalid");
    return {
      allowed: used < cap,
      budgetKind: limit.budget_kind,
      used,
      limit: cap,
      remaining: Math.max(0, cap - used),
      reason: used < cap ? null : `Budget exhausted: ${limit.budget_kind} (${used}/${cap})`,
    };
  });
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
  if (!Number.isFinite(input.value) || input.value < 0)
    throw new Error("Budget usage must be finite and non-negative");
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
  if (!Number.isFinite(input.limitValue) || input.limitValue < 0)
    throw new Error("Budget limit must be finite and non-negative");
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

export function budgetPeriodStart(period: BudgetLimit["period"], day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (period === "weekly") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  else if (period === "monthly") date.setUTCDate(1);
  else if (period !== "daily" && period !== "per_work_item")
    throw new Error("Unsupported budget period");
  return date.toISOString().slice(0, 10);
}

export async function claimResourceBudget(
  supabase: SupabaseClient,
  input: {
    coworkerId: string | null;
    budgetKind: BudgetKind;
    amount: number;
    operationKey: string;
    workItemId?: string;
  },
) {
  if (!Number.isFinite(input.amount) || input.amount < 0 || !input.operationKey.trim())
    throw new Error("Invalid budget reservation");
  const { data, error } = await supabase
    .rpc("claim_budget_usage", {
      p_coworker_id: input.coworkerId,
      p_budget_kind: input.budgetKind,
      p_amount: input.amount,
      p_operation_key: input.operationKey,
      p_work_item_id: input.workItemId ?? null,
    })
    .single();
  if (error) throw new Error(`Budget reservation failed: ${error.message}`);
  const receipt = data as { allowed: boolean; replayed: boolean; reason: string };
  if (!receipt?.allowed) throw new Error(receipt?.reason ?? "Budget reservation refused");
  return receipt;
}
