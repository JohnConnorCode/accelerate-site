import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callModelBudgetRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { getModelRegistration } from "./model-registry";
import { getOpenRouterQuote } from "./model-pricing";
import {
  getOpenRouterGeneration,
  openRouterChat,
  type OpenRouterMessage,
  type OpenRouterResponse,
} from "./openrouter";

const modelBudgetPolicySchema = z.object({
  modelMode: z.enum(["off", "free-only", "budgeted-low-cost"]),
  preferredModel: z.string().max(2000),
  maxModelCallsPerDay: z.number().int().min(0).max(20),
  dailyModelBudgetUsd: z.number().min(0).max(100),
  maxInputTokensPerCall: z.number().int().min(1024).max(16000),
  maxOutputTokensPerCall: z.number().int().min(256).max(4000),
  maxCostPerRunUsd: z.number().min(0).max(1),
});
export type ModelBudgetPolicy = z.infer<typeof modelBudgetPolicySchema>;
export type BudgetedModelResult<T> = {
  status: "completed" | "cached" | "deferred" | "failed" | "uncertain";
  reason?: string;
  receiptId?: string;
  reservedUsd?: number;
  actualUsd?: number | null;
  result?: T;
};
/** Only trusted job adapters supply schema/parser and policy. No arbitrary provider or model fallback. */
export async function runBudgetedModel<T>(
  database: SupabaseClient,
  input: {
    moduleKey: string;
    operationId: string;
    workItemId?: string;
    policy: ModelBudgetPolicy;
    expectedConfig: Record<string, unknown>;
    jobVersion: string;
    messages: OpenRouterMessage[];
    schema: Record<string, unknown>;
    parse: (value: unknown) => T;
    signal?: AbortSignal;
  },
): Promise<BudgetedModelResult<T>> {
  const tenantId = tenantIdForDatabase(database);
  if (!tenantId) throw new Error("Budgeted model requires tenant context");
  const policy = modelBudgetPolicySchema.parse(input.policy);
  const deferred = (reason: string): BudgetedModelResult<T> => ({ status: "deferred", reason });
  if (policy.modelMode === "off" || policy.maxModelCallsPerDay === 0)
    return deferred("Model calls are disabled");
  if (input.signal?.aborted) return deferred("Request cancelled before admission");
  if (!policy.preferredModel.trim()) return deferred("Choose an evaluated model explicitly");
  if (
    policy.modelMode === "budgeted-low-cost" &&
    (policy.dailyModelBudgetUsd <= 0 || policy.maxCostPerRunUsd <= 0)
  )
    return deferred("Paid model budget is zero");
  const model = await getModelRegistration(database, tenantId, policy.preferredModel);
  if (
    !model ||
    !model.evalPassed ||
    !model.supportsJson ||
    !["free", "low"].includes(model.costTier)
  )
    return deferred("Model must be registered, evaluated, JSON-capable and free or low cost");
  const format = {
    type: "json_schema" as const,
    json_schema: { name: "budgeted_business_result", strict: true as const, schema: input.schema },
  };
  // Conservative UTF-8 byte bound plus framing allowance; no context is silently truncated.
  const inputTokens =
    Buffer.byteLength(
      JSON.stringify({ messages: input.messages, response_format: format }),
      "utf8",
    ) + 1024;
  if (
    inputTokens > policy.maxInputTokensPerCall ||
    inputTokens + policy.maxOutputTokensPerCall > model.contextWindow
  )
    return deferred("Input exceeds the configured token/context bound");
  let quote: Awaited<ReturnType<typeof getOpenRouterQuote>>;
  try {
    quote = await getOpenRouterQuote(model.id);
  } catch {
    return deferred("Current compatible model pricing could not be verified");
  }
  if (!quote.jsonSchema || quote.context < inputTokens + policy.maxOutputTokensPerCall)
    return deferred("Provider metadata does not support the required bounded structured output");
  if (
    policy.modelMode === "free-only" &&
    (quote.promptPerMillion !== 0 || quote.completionPerMillion !== 0 || quote.request !== 0)
  )
    return deferred("Free-only requires verified zero pricing; no paid fallback is permitted");
  const reservedUsd =
    Math.ceil(
      ((inputTokens * quote.promptPerMillion) / 1e6 +
        (policy.maxOutputTokensPerCall * quote.completionPerMillion) / 1e6 +
        quote.request) *
        1e9,
    ) / 1e9;
  if (reservedUsd > policy.maxCostPerRunUsd || reservedUsd > policy.dailyModelBudgetUsd)
    return deferred("Worst-case model cost exceeds the configured budget");
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        tenantId,
        module: input.moduleKey,
        day: new Date().toISOString().slice(0, 10),
        job: input.jobVersion,
        workItemId: input.workItemId ?? null,
        messages: input.messages,
        schema: input.schema,
        config: input.expectedConfig,
        model,
        pricing: quote.fingerprint,
        policy,
      }),
    )
    .digest("hex");
  const reservation = await callModelBudgetRpc(database, "reserve_model_call", {
    p_module_key: input.moduleKey,
    p_operation_key: input.operationId,
    p_cache_key: cacheKey,
    p_model: model.id,
    p_reserved_usd: reservedUsd,
    p_input_tokens: inputTokens,
    p_output_tokens: policy.maxOutputTokensPerCall,
    p_daily_calls: policy.maxModelCallsPerDay,
    p_daily_usd: policy.dailyModelBudgetUsd,
    p_run_usd: policy.maxCostPerRunUsd,
    p_expected_config: input.expectedConfig,
    p_work_item_id: input.workItemId ?? null,
  });
  if (reservation.error) throw new Error("Model budget admission failed; no request was made");
  const admitted = reservation.data as {
    status: string;
    reason?: string;
    receipt?: { id: string; result: unknown; reserved_usd: number; actual_usd: number | null };
  };
  if (admitted.status === "cached" && admitted.receipt)
    return {
      status: "cached",
      receiptId: admitted.receipt.id,
      reservedUsd: admitted.receipt.reserved_usd,
      actualUsd: admitted.receipt.actual_usd,
      result: input.parse(admitted.receipt.result),
    };
  if (admitted.status !== "reserved" || !admitted.receipt)
    return deferred(admitted.reason ?? "Model request was not admitted");
  const id = admitted.receipt.id;
  let response: OpenRouterResponse | undefined;
  let result: T | undefined;
  let dispatched = false;
  const assertCurrent = async () => {
    if (input.signal?.aborted) throw new Error("Request cancelled");
    const fresh = await database
      .from("tenants")
      .select("config,status")
      .eq("id", tenantId)
      .single();
    if (
      fresh.error ||
      fresh.data?.status !== "active" ||
      JSON.stringify(fresh.data.config) !== JSON.stringify(input.expectedConfig)
    )
      throw new Error("Workspace changed during model execution");
  };
  let state = "completed";
  let reason: string | null = null;
  try {
    response = await openRouterChat({
      database,
      model: model.id,
      messages: input.messages,
      responseFormat: format,
      maxTokens: policy.maxOutputTokensPerCall,
      signal: input.signal,
      strictPricing: {
        prompt: quote.promptPerMillion,
        completion: quote.completionPerMillion,
        request: quote.request,
      },
      beforeAttempt: async () => {
        await assertCurrent();
        dispatched = true;
      },
    });
    if (response.model !== model.id || response.choices[0]?.finish_reason !== "stop")
      throw new Error("Model identity or completion status differs from the admitted request");
    if (typeof response.id !== "string" || !/^gen-[a-zA-Z0-9_-]{1,196}$/.test(response.id))
      throw new Error("Provider generation identity is missing or invalid");
    const usage = response.usage;
    if (
      !usage ||
      !Number.isInteger(usage.prompt_tokens) ||
      !Number.isInteger(usage.completion_tokens) ||
      usage.prompt_tokens! < 0 ||
      usage.prompt_tokens! > inputTokens ||
      usage.completion_tokens! < 0 ||
      usage.completion_tokens! > policy.maxOutputTokensPerCall
    )
      throw new Error("Model usage is missing or exceeds admitted token bounds");
    result = input.parse(JSON.parse(response.choices[0].message.content ?? ""));
    await assertCurrent();
  } catch {
    // Error strings can contain provider/user data; only a fixed explanation reaches receipts.
    state = !dispatched || response?.usage?.cost !== undefined ? "failed" : "uncertain";
    reason = "Model request failed validation, was cancelled, or has an uncertain provider result";
  }
  const settled = await callModelBudgetRpc(database, "complete_model_call", {
    p_id: id,
    p_state: state,
    p_model:
      typeof response?.model === "string" && response.model.length <= 200 ? response.model : null,
    p_request_id:
      typeof response?.id === "string" && /^gen-[a-zA-Z0-9_-]{1,196}$/.test(response.id)
        ? response.id
        : null,
    p_usage: !dispatched
      ? { cost: 0, prompt_tokens: 0, completion_tokens: 0 }
      : response?.usage
        ? {
            cost: response.usage.cost,
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
          }
        : null,
    p_result: state === "completed" ? result : null,
    p_reason: reason,
  });
  if (settled.error)
    throw new Error(
      "Model settlement is unavailable; the reservation remains held and must be reconciled",
    );
  const receipt = settled.data as {
    state: "completed" | "failed" | "uncertain";
    reason?: string;
    actual_usd: number | null;
  };
  return {
    status: receipt.state,
    receiptId: id,
    reservedUsd,
    actualUsd: receipt.actual_usd,
    ...(receipt.reason ? { reason: receipt.reason } : {}),
    ...(receipt.state === "completed" ? { result } : {}),
  };
}

/** Reconcile only provider IDs already bound to this tenant's receipt. Never retries inference. */
export async function reconcileBudgetedModel(
  database: SupabaseClient,
  moduleKey: string,
  receiptId: string,
) {
  const tenantId = tenantIdForDatabase(database);
  if (!tenantId) throw new Error("Model reconciliation requires tenant context");
  const stored = await database
    .from("model_call_receipts")
    .select("id,state,requested_model,provider_request_id,created_at")
    .eq("id", receiptId)
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey)
    .single();
  if (stored.error || !stored.data) throw new Error("Model receipt unavailable");
  const receipt = stored.data;
  if (!["uncertain", "reserved"].includes(receipt.state))
    return { status: receipt.state, receiptId };
  if (!receipt.provider_request_id)
    return {
      status: "uncertain",
      receiptId,
      reason:
        "No stored provider generation ID; provider investigation is required. Do not retry this request.",
    };
  const generation = await getOpenRouterGeneration(database, receipt.provider_request_id);
  const age = Date.parse(generation.created_at) - Date.parse(receipt.created_at);
  if (generation.model !== receipt.requested_model || age < -5000 || age > 120_000)
    throw new Error(
      "Provider generation does not match the admitted model/time; reservation remains held",
    );
  const settled = await callModelBudgetRpc(database, "complete_model_call", {
    p_id: receiptId,
    p_state: "failed",
    p_model: generation.model,
    p_request_id: generation.id,
    p_usage: {
      cost: generation.total_cost,
      prompt_tokens: generation.native_tokens_prompt,
      completion_tokens: generation.native_tokens_completion,
    },
    p_result: null,
    p_reason: "Provider charge reconciled; uncertain output remains discarded",
  });
  if (settled.error)
    throw new Error("Model reconciliation could not be recorded; reservation remains held");
  const final = settled.data as { state: string; actual_usd: number | null; reason: string | null };
  return { status: final.state, receiptId, actualUsd: final.actual_usd, reason: final.reason };
}
