import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutonomyLevel =
  | "prohibited"
  | "always_ask"
  | "ask_until_trusted"
  | "standing_permission"
  | "autonomous";

export interface AutonomyPolicy {
  id: string;
  tenant_id: string;
  action_key: string;
  label: string;
  description: string | null;
  level: AutonomyLevel;
  constraints: Record<string, unknown>;
  coworker_id: string | null;
  source: string;
  approved_by: string | null;
  approved_at: string | null;
  is_hard_floor: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutonomyCheckResult {
  actionKey: string;
  allowed: boolean;
  level: AutonomyLevel;
  requiresApproval: boolean;
  policyId: string | null;
  hardFloor: boolean;
  reason: string;
}

export interface HardFloor {
  id: string;
  tenant_id: string;
  action_key: string;
  reason: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Check autonomy: is an action allowed, and does it need approval?
// ---------------------------------------------------------------------------

export async function checkAutonomy(
  supabase: SupabaseClient,
  actionKey: string,
  coworkerId?: string | null,
): Promise<AutonomyCheckResult> {
  const { data, error } = await supabase
    .rpc("check_autonomy", {
      p_action_key: actionKey,
      p_coworker_id: coworkerId ?? null,
    })
    .single();

  if (error) throw new Error(error.message);

  const result = data as {
    action_key: string;
    allowed: boolean;
    level: AutonomyLevel;
    requires_approval: boolean;
    policy_id: string | null;
    hard_floor: boolean;
    reason: string;
  };

  return {
    actionKey: result.action_key,
    allowed: result.allowed,
    level: result.level,
    requiresApproval: result.requires_approval,
    policyId: result.policy_id,
    hardFloor: result.hard_floor,
    reason: result.reason,
  };
}

// ---------------------------------------------------------------------------
// List autonomy policies
// ---------------------------------------------------------------------------

export async function listAutonomyPolicies(
  supabase: SupabaseClient,
  input?: {
    coworkerId?: string | null;
    level?: AutonomyLevel;
  },
): Promise<AutonomyPolicy[]> {
  let query = supabase
    .from("autonomy_policies")
    .select("*")
    .order("action_key", { ascending: true });

  if (input?.coworkerId) {
    query = query.eq("coworker_id", input.coworkerId);
  }
  if (input?.level) {
    query = query.eq("level", input.level);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AutonomyPolicy[];
}

// ---------------------------------------------------------------------------
// List hard floors
// ---------------------------------------------------------------------------

export async function listHardFloors(
  supabase: SupabaseClient,
): Promise<HardFloor[]> {
  const { data, error } = await supabase
    .from("autonomy_hard_floors")
    .select("*")
    .order("action_key", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as HardFloor[];
}

// ---------------------------------------------------------------------------
// Register / update an autonomy policy (upsert via RPC)
// ---------------------------------------------------------------------------

export async function registerAutonomyPolicy(
  supabase: SupabaseClient,
  input: {
    actionKey: string;
    label: string;
    level?: AutonomyLevel;
    description?: string | null;
    constraints?: Record<string, unknown>;
    coworkerId?: string | null;
    source?: string;
    isHardFloor?: boolean;
    actorEmail?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_autonomy_policy", {
    p_action_key: input.actionKey,
    p_label: input.label,
    p_level: input.level ?? "always_ask",
    p_description: input.description ?? null,
    p_constraints: input.constraints ?? {},
    p_coworker_id: input.coworkerId ?? null,
    p_source: input.source ?? "system",
    p_is_hard_floor: input.isHardFloor ?? false,
  });

  if (error) throw new Error(error.message);

  const policyId = data as string;
  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "autonomy_policy.registered",
    entityType: "autonomy_policy",
    entityId: policyId,
    source: "automation",
    after: {
      action_key: input.actionKey,
      level: input.level ?? "always_ask",
      is_hard_floor: input.isHardFloor ?? false,
    },
  });

  return policyId;
}

// ---------------------------------------------------------------------------
// Grant standing permission: upgrade ask_until_trusted → standing_permission
// ---------------------------------------------------------------------------

export async function grantStandingPermission(
  supabase: SupabaseClient,
  input: {
    actionKey: string;
    coworkerId?: string | null;
    approvedBy: string;
    constraints?: Record<string, unknown>;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("grant_standing_permission", {
    p_action_key: input.actionKey,
    p_coworker_id: input.coworkerId ?? null,
    p_approved_by: input.approvedBy,
    p_constraints: input.constraints ?? {},
  });

  if (error) throw new Error(error.message);

  const policyId = data as string;
  await recordAudit(supabase, {
    actorEmail: input.approvedBy,
    action: "autonomy_policy.standing_permission_granted",
    entityType: "autonomy_policy",
    entityId: policyId,
    source: "automation",
    after: {
      action_key: input.actionKey,
      level: "standing_permission",
      approved_by: input.approvedBy,
      constraints: input.constraints ?? {},
    },
  });

  return policyId;
}
