import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OPENROUTER_MODEL } from "./openrouter";

/**
 * Audited model registry (ai-model-job-registry): AI calls name a registered
 * job, and every call records requested vs resolved models so fallback and
 * model changes are never silent.
 *
 * Models are operator-registered rows (admin_settings KV), never invented
 * IDs: the only built-in entry is the repository default already serving
 * traffic. Jobs declare typed workload requirements (tools, JSON mode,
 * context floor); compatibility is MATCHED against model capabilities, so
 * operator choices are limited without hardcoding provider lineups.
 * Free/low-cost models stay visible but cannot run consequential jobs until
 * an eval set passes and records it.
 */

export type ModelCostTier = "free" | "low" | "standard" | "premium";

export interface ModelRegistration {
  id: string;
  label: string;
  costTier: ModelCostTier;
  supportsTools: boolean;
  supportsJson: boolean;
  contextWindow: number;
  evalPassed: boolean;
  evaluatedAt: string | null;
  evaluatedBy: string | null;
}

export interface JobRegistration {
  key: string;
  label: string;
  /** Consequential jobs refuse unevaluated free/low models and always need approval paths. */
  consequential: boolean;
  requiresTools: boolean;
  requiresJson: boolean;
  minContextWindow: number;
  defaultModel: string;
  /** Optional explicit allowlist intersecting the capability match. */
  allowedModels?: string[];
}

/** Built-in seed: the only model id grounded in this repository (the live
 * default). Everything else is operator-registered, never invented. */
const BUILT_IN_MODEL_ID = DEFAULT_OPENROUTER_MODEL;

const BUILT_IN_REGISTRATION: Omit<ModelRegistration, "evalPassed" | "evaluatedAt" | "evaluatedBy"> =
  {
    id: BUILT_IN_MODEL_ID,
    label: "GPT-4.1 Mini (default)",
    costTier: "low",
    supportsTools: true,
    supportsJson: true,
    contextWindow: 1_047_576,
  };

export const AI_JOBS: readonly JobRegistration[] = [
  {
    key: "copilot-answer",
    label: "Revenue Copilot answer",
    consequential: true,
    requiresTools: true,
    requiresJson: false,
    minContextWindow: 128_000,
    defaultModel: BUILT_IN_MODEL_ID,
  },
  {
    key: "responder-draft",
    label: "First-touch responder draft",
    consequential: true,
    requiresTools: false,
    requiresJson: true,
    minContextWindow: 32_000,
    defaultModel: BUILT_IN_MODEL_ID,
  },
  {
    key: "public-chat",
    label: "Public prospect assistant",
    consequential: false,
    requiresTools: false,
    requiresJson: false,
    minContextWindow: 16_000,
    defaultModel: BUILT_IN_MODEL_ID,
  },
  {
    key: "content-brief",
    label: "Content brief generation",
    consequential: false,
    requiresTools: false,
    requiresJson: true,
    minContextWindow: 32_000,
    defaultModel: BUILT_IN_MODEL_ID,
  },
  {
    key: "proposal-draft",
    label: "Proposal draft generation",
    consequential: true,
    requiresTools: false,
    requiresJson: true,
    minContextWindow: 64_000,
    defaultModel: BUILT_IN_MODEL_ID,
  },
];

function settingKey(modelId: string): string {
  return `ai-model:${modelId}`;
}

function requireTenant(tenantId: string): string {
  const id = tenantId?.trim();
  if (!id) throw new Error("A tenant id is required for model registry access");
  return id;
}

function normalizeId(id: string, what: string): string {
  const value = id?.trim();
  if (!value) throw new Error(`${what} is required`);
  if (value.length > 200) throw new Error(`${what} is too long`);
  return value;
}

function toRegistration(
  modelId: string,
  stored: Record<string, unknown> | null,
): ModelRegistration {
  if (!stored) {
    return {
      ...BUILT_IN_REGISTRATION,
      evalPassed: false,
      evaluatedAt: null,
      evaluatedBy: null,
    };
  }
  const costTier = stored.costTier;
  return {
    id: modelId,
    label: typeof stored.label === "string" ? stored.label : modelId,
    costTier:
      costTier === "free" || costTier === "low" || costTier === "standard" || costTier === "premium"
        ? costTier
        : "standard",
    supportsTools: stored.supportsTools !== false,
    supportsJson: stored.supportsJson !== false,
    contextWindow: Number.isFinite(Number(stored.contextWindow)) ? Number(stored.contextWindow) : 0,
    evalPassed: stored.evalPassed === true,
    evaluatedAt: typeof stored.evaluatedAt === "string" ? stored.evaluatedAt : null,
    evaluatedBy: typeof stored.evaluatedBy === "string" ? stored.evaluatedBy : null,
  };
}

/**
 * Register (or re-register) a model. Upsert semantics: idempotent,
 * last-writer-wins on metadata, never duplicates.
 */
export async function registerModel(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    id: string;
    label?: string;
    costTier?: ModelCostTier;
    supportsTools?: boolean;
    supportsJson?: boolean;
    contextWindow?: number;
    actorEmail: string;
  },
): Promise<ModelRegistration> {
  const tenantId = requireTenant(input.tenantId);
  const id = normalizeId(input.id, "A model id");
  const existing = await getModelRegistration(supabase, tenantId, id).catch(() => null);
  const stored = {
    label: input.label?.trim() || existing?.label || id,
    costTier: input.costTier || existing?.costTier || "standard",
    supportsTools: input.supportsTools ?? existing?.supportsTools ?? true,
    supportsJson: input.supportsJson ?? existing?.supportsJson ?? true,
    contextWindow: Number.isFinite(Number(input.contextWindow))
      ? Number(input.contextWindow)
      : (existing?.contextWindow ?? 0),
    evalPassed: existing?.evalPassed ?? false,
    evaluatedAt: existing?.evaluatedAt ?? null,
    evaluatedBy: existing?.evaluatedBy ?? null,
  };
  const { error } = await supabase.from("admin_settings").upsert(
    {
      tenant_id: tenantId,
      key: settingKey(id),
      value: JSON.stringify(stored),
      is_secret: false,
      description: "AI model registry entry",
    },
    { onConflict: "tenant_id,key" },
  );
  if (error) throw new Error(`Could not register model ${id}: ${error.message}`);
  return { id, ...stored } as ModelRegistration;
}

export async function getModelRegistration(
  supabase: SupabaseClient,
  tenantId: string,
  modelId: string,
): Promise<ModelRegistration | null> {
  const id = normalizeId(modelId, "A model id");
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("tenant_id", requireTenant(tenantId))
    .eq("key", settingKey(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = (data as { value?: unknown } | null)?.value ?? null;
  if (raw === null) {
    // The built-in default resolves without a stored row so a fresh install
    // answers before any operator registration exists.
    if (id === BUILT_IN_MODEL_ID) return toRegistration(id, null);
    return null;
  }
  let stored: Record<string, unknown> | null = null;
  try {
    stored = JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    throw new Error(`Stored model registration for ${id} is corrupt and will not be guessed`);
  }
  return toRegistration(id, stored);
}

/**
 * Record an eval outcome. Passing unlocks free/low-cost models for
 * consequential jobs; the who/when travels with the verdict.
 */
export async function setModelEvalStatus(
  supabase: SupabaseClient,
  input: { tenantId: string; modelId: string; passed: boolean; actorEmail: string; notes?: string },
): Promise<ModelRegistration> {
  const tenantId = requireTenant(input.tenantId);
  const current =
    (await getModelRegistration(supabase, tenantId, input.modelId)) ??
    (await registerModel(supabase, { tenantId, id: input.modelId, actorEmail: input.actorEmail }));
  const { error } = await supabase.from("admin_settings").upsert(
    {
      tenant_id: tenantId,
      key: settingKey(current.id),
      value: JSON.stringify({
        label: current.label,
        costTier: current.costTier,
        supportsTools: current.supportsTools,
        supportsJson: current.supportsJson,
        contextWindow: current.contextWindow,
        evalPassed: input.passed,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: input.actorEmail,
        notes: input.notes ?? null,
      }),
      is_secret: false,
      description: "AI model registry entry",
    },
    { onConflict: "tenant_id,key" },
  );
  if (error) throw new Error(`Could not record eval status: ${error.message}`);
  return { ...current, evalPassed: input.passed };
}

export interface ModelResolution {
  job: string;
  requested: string;
  resolved: string;
  fallbackEligible: boolean;
}

/**
 * Resolve which model serves a job: the operator preference when granted and
 * compatible, else the job default. Unknown jobs, unlisted models,
 * capability mismatches, and unevaluated cheap models on consequential jobs
 * all refuse loudly. Environment overrides stay explicit: the receipt always
 * carries both requested and resolved.
 */
export async function resolveModelForJob(
  supabase: SupabaseClient,
  tenantId: string,
  jobKey: string,
  preferred?: string | null,
): Promise<ModelResolution> {
  const tenant = requireTenant(tenantId);
  const job = AI_JOBS.find((candidate) => candidate.key === jobKey);
  if (!job) throw new Error(`Unknown AI job ${JSON.stringify(jobKey)}`);
  const requested = preferred?.trim() || job.defaultModel;
  const model = await getModelRegistration(supabase, tenant, requested);
  if (!model) throw new Error(`Model ${JSON.stringify(requested)} is not registered`);
  if (job.allowedModels && !job.allowedModels.includes(model.id))
    throw new Error(`Model ${model.id} is not allowed for job ${jobKey}`);
  if (job.requiresTools && !model.supportsTools)
    throw new Error(`Job ${jobKey} needs tool calling, which ${model.id} does not support`);
  if (job.requiresJson && !model.supportsJson)
    throw new Error(`Job ${jobKey} needs JSON mode, which ${model.id} does not support`);
  if (model.contextWindow < job.minContextWindow)
    throw new Error(
      `Job ${jobKey} needs ${job.minContextWindow} context, but ${model.id} offers ${model.contextWindow}`,
    );
  if (
    job.consequential &&
    (model.costTier === "free" || model.costTier === "low") &&
    !model.evalPassed
  )
    throw new Error(
      `Model ${model.id} is ${model.costTier}-cost and unevaluated: it cannot run consequential job ${jobKey} until its eval set passes`,
    );
  return { job: jobKey, requested, resolved: model.id, fallbackEligible: true };
}

/**
 * Attribute one model call: which job, what was requested, what actually
 * served (including provider-side fallback), so fallback and model changes
 * are never silent and always auditable.
 */
export async function recordModelCall(
  supabase: SupabaseClient,
  input: {
    job: string;
    requested: string;
    resolved: string;
    tenantId: string;
    actorEmail?: string | null;
    latencyMs?: number | null;
  },
): Promise<{ id: string }> {
  const job = input.job?.trim();
  if (!job) throw new Error("A job key is required to record a model call");
  // Attribution is the point of the receipt: unattributed calls refuse
  // rather than landing in a global bucket nobody can bill or audit.
  const tenantId = requireTenant(input.tenantId);
  const switched = input.requested !== input.resolved;
  const { data, error } = await supabase
    .from("activities")
    .insert({
      tenant_id: tenantId,
      activity_type: "model_call",
      title: `Model ${switched ? `${input.requested} → ${input.resolved}` : input.resolved} served ${job}`,
      summary: switched
        ? `Fallback or model change during ${job}: requested ${input.requested}, served ${input.resolved}.`
        : `Job ${job} served by ${input.resolved}.`,
      source: "ai-gateway",
      actor_email: input.actorEmail ?? null,
      external_id: `model:${job}:${input.resolved}:${Date.now()}`,
      metadata: {
        job,
        requested: input.requested,
        resolved: input.resolved,
        fallback: switched,
        latency_ms: input.latencyMs ?? null,
      },
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Could not record model call: ${error?.message || "no receipt"}`);
  return { id: (data as { id: string }).id };
}
