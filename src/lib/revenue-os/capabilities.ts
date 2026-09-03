import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapabilityCategory = "integration" | "runtime" | "plugin" | "system";
export type CapabilityDirection = "read" | "write" | "bidirectional";
export type CapabilityImpact = "read" | "internal_write" | "external_action";
export type CapabilityPolicy = "automatic" | "approval_required" | "prohibited";

export interface WorkspaceCapability {
  id: string;
  tenant_id: string;
  capability_key: string;
  label: string;
  category: CapabilityCategory;
  direction: CapabilityDirection;
  impact: CapabilityImpact;
  available: boolean;
  policy: CapabilityPolicy | null;
  source: string;
  integration_id: string | null;
  verified_at: string | null;
  status_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapabilityResolution {
  capabilityKey: string;
  available: boolean;
  policy: CapabilityPolicy | null;
  statusReason: string | null;
  verifiedAt: string | null;
}

// ---------------------------------------------------------------------------
// Resolve: check whether a specific capability is available
// ---------------------------------------------------------------------------

export async function resolveCapability(
  supabase: SupabaseClient,
  capabilityKey: string,
): Promise<CapabilityResolution> {
  const { data, error } = await supabase
    .rpc("resolve_workspace_capability", {
      p_capability_key: capabilityKey,
    })
    .single();

  if (error) throw new Error(error.message);

  const result = data as {
    capability_key: string;
    available: boolean;
    policy: string | null;
    status_reason: string | null;
    verified_at: string | null;
  };

  return {
    capabilityKey: result.capability_key,
    available: result.available,
    policy: (result.policy as CapabilityPolicy) ?? null,
    statusReason: result.status_reason,
    verifiedAt: result.verified_at,
  };
}

// ---------------------------------------------------------------------------
// Check capabilities before work: returns unavailable keys
// ---------------------------------------------------------------------------

export async function checkCapabilitiesBeforeWork(
  supabase: SupabaseClient,
  requiredCapabilities: string[],
): Promise<{ missing: string[]; unavailable: string[]; policyBlocked: string[] }> {
  const missing: string[] = [];
  const unavailable: string[] = [];
  const policyBlocked: string[] = [];

  for (const key of requiredCapabilities) {
    const resolution = await resolveCapability(supabase, key);

    if (
      !resolution.available &&
      resolution.statusReason === "Capability not registered in this workspace"
    ) {
      missing.push(key);
    } else if (!resolution.available) {
      unavailable.push(key);
    } else if (resolution.policy === "prohibited") {
      policyBlocked.push(key);
    }
  }

  return { missing, unavailable, policyBlocked };
}

// ---------------------------------------------------------------------------
// List capabilities for a tenant
// ---------------------------------------------------------------------------

export async function listWorkspaceCapabilities(
  supabase: SupabaseClient,
  input?: {
    category?: CapabilityCategory;
    availableOnly?: boolean;
  },
): Promise<WorkspaceCapability[]> {
  let query = supabase
    .from("workspace_capabilities")
    .select("*")
    .order("category", { ascending: true })
    .order("capability_key", { ascending: true });

  if (input?.category) {
    query = query.eq("category", input.category);
  }
  if (input?.availableOnly) {
    query = query.eq("available", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceCapability[];
}

// ---------------------------------------------------------------------------
// Register / update a capability (upsert via RPC)
// ---------------------------------------------------------------------------

export async function registerCapability(
  supabase: SupabaseClient,
  input: {
    capabilityKey: string;
    label: string;
    category?: CapabilityCategory;
    direction?: CapabilityDirection;
    impact?: CapabilityImpact;
    available?: boolean;
    policy?: CapabilityPolicy | null;
    source?: string;
    integrationId?: string | null;
    statusReason?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_workspace_capability", {
    p_capability_key: input.capabilityKey,
    p_label: input.label,
    p_category: input.category ?? "integration",
    p_direction: input.direction ?? "read",
    p_impact: input.impact ?? "read",
    p_available: input.available ?? false,
    p_policy: input.policy ?? null,
    p_source: input.source ?? "integration_registry",
    p_integration_id: input.integrationId ?? null,
    p_status_reason: input.statusReason ?? null,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

// ---------------------------------------------------------------------------
// Sync from integration-registry: bulk-register capabilities
// ---------------------------------------------------------------------------

export async function syncCapabilitiesFromRegistry(
  supabase: SupabaseClient,
  capabilities: Array<{
    capabilityKey: string;
    label: string;
    direction: CapabilityDirection;
    impact: CapabilityImpact;
    integrationId: string;
    available: boolean;
    policy?: CapabilityPolicy | null;
    statusReason?: string | null;
  }>,
): Promise<{ synced: number; errors: string[] }> {
  let synced = 0;
  const errors: string[] = [];

  for (const cap of capabilities) {
    try {
      await registerCapability(supabase, {
        capabilityKey: cap.capabilityKey,
        label: cap.label,
        category: "integration",
        direction: cap.direction,
        impact: cap.impact,
        available: cap.available,
        policy: cap.policy,
        source: "integration_registry",
        integrationId: cap.integrationId,
        statusReason: cap.statusReason,
      });
      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${cap.capabilityKey}: ${msg}`);
    }
  }

  return { synced, errors };
}
