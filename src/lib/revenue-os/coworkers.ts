import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";
import { checkCapabilitiesBeforeWork } from "./capabilities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoworkerStatus = "active" | "paused" | "disabled";
export type CoworkerToolPack = "core" | "pipeline" | "outreach";

export interface Coworker {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  description: string | null;
  status: CoworkerStatus;
  model: string | null;
  tool_pack: CoworkerToolPack;
  required_capabilities: string[];
  work_kinds: string[];
  autonomy_overrides: Record<string, unknown>;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CoworkerManifest {
  coworker: Coworker;
  capabilityGaps: string[];
  readyToWork: boolean;
}

// ---------------------------------------------------------------------------
// Register / update a coworker
// ---------------------------------------------------------------------------

export async function registerCoworker(
  supabase: SupabaseClient,
  input: {
    id: string;
    name: string;
    role: string;
    description?: string | null;
    status?: CoworkerStatus;
    model?: string | null;
    toolPack?: CoworkerToolPack;
    requiredCapabilities?: string[];
    workKinds?: string[];
    autonomyOverrides?: Record<string, unknown>;
    config?: Record<string, unknown>;
    actorEmail?: string | null;
  },
): Promise<Coworker> {
  const id = input.id.trim();
  const name = input.name.trim();
  const role = input.role.trim();

  if (!id) throw new Error("id is required");
  if (!name) throw new Error("name is required");
  if (!role) throw new Error("role is required");

  // Upsert: insert or update
  const { data: existing } = await supabase
    .from("coworkers")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("coworkers")
      .update({
        name,
        role,
        description: input.description ?? null,
        status: input.status ?? "active",
        model: input.model ?? null,
        tool_pack: input.toolPack ?? "core",
        required_capabilities: input.requiredCapabilities ?? [],
        work_kinds: input.workKinds ?? [],
        autonomy_overrides: input.autonomyOverrides ?? {},
        config: input.config ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Coworker;
  }

  const { data, error } = await supabase
    .from("coworkers")
    .insert({
      id,
      name,
      role,
      description: input.description ?? null,
      status: input.status ?? "active",
      model: input.model ?? null,
      tool_pack: input.toolPack ?? "core",
      required_capabilities: input.requiredCapabilities ?? [],
      work_kinds: input.workKinds ?? [],
      autonomy_overrides: input.autonomyOverrides ?? {},
      config: input.config ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail || "system",
    action: "coworker.registered",
    entityType: "coworker",
    entityId: id,
    source: "automation",
    after: { name, role, status: input.status ?? "active", tool_pack: input.toolPack ?? "core" },
  });

  return data as Coworker;
}

// ---------------------------------------------------------------------------
// List coworkers
// ---------------------------------------------------------------------------

export async function listCoworkers(
  supabase: SupabaseClient,
  input?: {
    status?: CoworkerStatus;
    workKind?: string;
  },
): Promise<Coworker[]> {
  let query = supabase
    .from("coworkers")
    .select("*")
    .order("name", { ascending: true });

  if (input?.status) {
    query = query.eq("status", input.status);
  }
  if (input?.workKind) {
    query = query.contains("work_kinds", [input.workKind]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Coworker[];
}

// ---------------------------------------------------------------------------
// Get a single coworker
// ---------------------------------------------------------------------------

export async function getCoworker(
  supabase: SupabaseClient,
  coworkerId: string,
): Promise<Coworker | null> {
  const { data, error } = await supabase
    .from("coworkers")
    .select("*")
    .eq("id", coworkerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Coworker | null;
}

// ---------------------------------------------------------------------------
// Get coworker manifest: coworker + capability gaps + readiness
// ---------------------------------------------------------------------------

export async function getCoworkerManifest(
  supabase: SupabaseClient,
  coworkerId: string,
): Promise<CoworkerManifest> {
  const coworker = await getCoworker(supabase, coworkerId);
  if (!coworker) throw new Error(`Coworker not found: ${coworkerId}`);

  if (!coworker.required_capabilities.length) {
    return { coworker, capabilityGaps: [], readyToWork: coworker.status === "active" };
  }

  const { missing, unavailable, policyBlocked } = await checkCapabilitiesBeforeWork(
    supabase,
    coworker.required_capabilities,
  );

  const capabilityGaps = [...missing, ...unavailable, ...policyBlocked];
  return {
    coworker,
    capabilityGaps,
    readyToWork: coworker.status === "active" && capabilityGaps.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Update coworker status
// ---------------------------------------------------------------------------

export async function updateCoworkerStatus(
  supabase: SupabaseClient,
  coworkerId: string,
  status: CoworkerStatus,
  actorEmail?: string | null,
): Promise<void> {
  const { data: before, error: readError } = await supabase
    .from("coworkers")
    .select("id, status, name")
    .eq("id", coworkerId)
    .single();
  if (readError) throw new Error(readError.message);

  const { error } = await supabase
    .from("coworkers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", coworkerId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: actorEmail || "system",
    action: "coworker.status_changed",
    entityType: "coworker",
    entityId: coworkerId,
    source: "automation",
    before: { status: before.status },
    after: { status },
  });
}
