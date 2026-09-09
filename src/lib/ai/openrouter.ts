import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readBoundedJson } from "./bounded-json";
import { tenant } from "@/config/tenant";
import "server-only";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOpenRouterCredential } from "@/lib/ai/openrouter-credentials";
import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterFallbackModel,
  getOpenRouterModel,
} from "@/lib/ai/openrouter-models";
import { recordModelCall, resolveModelForJob } from "@/lib/ai/model-registry";

export { DEFAULT_OPENROUTER_MODEL, getOpenRouterFallbackModel, getOpenRouterModel };

export type OpenRouterRole = "system" | "user" | "assistant" | "tool";

export interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
}

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterUsage {
  cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface OpenRouterStreamMetadata {
  requestId: string;
  model: string;
  usage: OpenRouterUsage;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    finish_reason?: string | null;
    message: OpenRouterMessage;
  }>;
  usage?: OpenRouterUsage;
}

export interface OpenRouterRequest {
  /** Non-streaming inference deadline; explicit callers may allow up to three minutes. */
  timeoutMs?: number;
  /** Bounded non-streaming reasoning configuration selected by the calling job. */
  reasoning?: { effort: "none" | "minimal" | "low" | "medium" | "high"; exclude?: boolean };
  /** Budgeted jobs pin one model and one attempt; no environment fallback. Prices are USD/million tokens. */
  strictPricing?: { prompt: number; completion: number; request: number };
  beforeAttempt?: (attempt: number) => Promise<void>;
  /** Tenant-bound database context used only to resolve the encrypted key. */
  database?: SupabaseClient;
  /**
   * Registered AI job key (see model-registry AI_JOBS). Required: every AI
   * call names its job so resolution is validated and receipts attributed.
   */
  job: string;
  /**
   * Owning tenant for model resolution and usage receipts. Optional: resolves
   * from the tenant-bound database client (or request context) when omitted;
   * pass explicitly only for unbound clients such as test doubles.
   */
  tenantId?: string;
  messages: OpenRouterMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: OpenRouterTool[];
  responseFormat?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
  signal?: AbortSignal;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId: string | null = null,
    public readonly inferenceRejected = false,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * The 45s timeout must apply even when a caller supplies its own signal.
 * Previously `input.signal ?? controller.signal` meant a caller-provided signal
 * detached the timeout entirely: the timer still fired, but it aborted a
 * controller nobody was listening to, so the request could hang until the
 * platform killed it.
 */
function combineSignals(timeoutSignal: AbortSignal, caller?: AbortSignal): AbortSignal {
  if (!caller) return timeoutSignal;
  const merge = (AbortSignal as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (typeof merge === "function") return merge([timeoutSignal, caller]);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (timeoutSignal.aborted || caller.aborted) controller.abort();
  timeoutSignal.addEventListener("abort", abort, { once: true });
  caller.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

/** Transient provider conditions worth a second attempt. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || (status >= 500 && status <= 599);
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

async function backoff(attempt: number): Promise<void> {
  // Exponential with jitter, so concurrent callers do not retry in lockstep.
  const ceiling = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  await new Promise((resolve) => setTimeout(resolve, ceiling / 2 + Math.random() * (ceiling / 2)));
}

function headers(key: string): HeadersInit {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || tenant.brand.siteUrl;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": siteUrl,
    "X-OpenRouter-Title": `${tenant.brand.name} Revenue OS`,
  };
}

/** Environment-only readiness is retained for local provider verification.
 * Product execution must pass a tenant-bound database; production refuses the
 * unscoped path even when a platform key exists. */
export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

async function requestApiKey(input: Pick<OpenRouterRequest, "database">): Promise<string> {
  if (input.database) {
    const credential = await resolveOpenRouterCredential(input.database);
    if (!credential)
      throw new OpenRouterError("OpenRouter is not configured for this workspace.", 503);
    return credential.apiKey;
  }
  if (process.env.NODE_ENV === "production")
    throw new OpenRouterError("OpenRouter execution requires an explicit tenant context.", 503);
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new OpenRouterError("OpenRouter is not configured.", 503);
  return key;
}

function boundedMessage(message: string): string {
  return message.replace(/(?:sk-or-v1-|Bearer\s+)[A-Za-z0-9._-]+/gi, "[redacted]").slice(0, 500);
}

function boundedProviderMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "OpenRouter request failed";
  const candidate = payload as { error?: { message?: unknown }; message?: unknown };
  const message =
    typeof candidate.error?.message === "string"
      ? candidate.error.message
      : typeof candidate.message === "string"
        ? candidate.message
        : "OpenRouter request failed";
  return boundedMessage(message);
}

async function attemptChat(
  input: OpenRouterRequest,
  model: string,
  apiKey: string,
): Promise<OpenRouterResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000);
  const startedAt = Date.now();
  const fallbackModel = input.strictPricing ? null : getOpenRouterFallbackModel();
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model,
        // Provider-side failover: OpenRouter tries the fallback itself if the
        // primary is down, which recovers faster than our own retry loop.
        ...(fallbackModel && fallbackModel !== model
          ? { models: [model, fallbackModel], route: "fallback" }
          : {}),
        messages: input.messages,
        ...(input.reasoning ? { reasoning: input.reasoning } : {}),
        max_tokens: Math.min(Math.max(input.maxTokens ?? 1200, 1), 8000),
        temperature: input.temperature ?? 0.2,
        ...(input.tools?.length ? { tools: input.tools, tool_choice: "auto" } : {}),
        ...(input.responseFormat
          ? {
              response_format: input.responseFormat,
              provider: { require_parameters: true },
            }
          : {}),
        ...(input.strictPricing
          ? {
              provider: {
                require_parameters: true,
                allow_fallbacks: false,
                data_collection: "deny",
                max_price: input.strictPricing,
              },
            }
          : {}),
      }),
      signal: combineSignals(controller.signal, input.signal),
    });
    const requestId = response.headers.get("x-request-id");
    const payload = (await (
      input.strictPricing ? readBoundedJson(response, 128 * 1024) : response.json()
    ).catch((error: unknown) => {
      // A streamed non-streaming response may send headers long before its JSON.
      // Preserve body aborts so timeout/cancellation cannot masquerade as HTTP 200.
      if (error instanceof Error && error.name === "AbortError") throw error;
      return null;
    })) as OpenRouterResponse | null;
    if (!response.ok || !payload) {
      const errorCode = (payload as { error?: { code?: unknown } } | null)?.error?.code;
      const rejected =
        !response.ok &&
        errorCode === response.status &&
        [400, 401, 402, 403, 404, 429].includes(response.status);
      const retryHeader = response.headers.get("retry-after");
      const seconds =
        retryHeader && /^\d+$/.test(retryHeader)
          ? Number(retryHeader)
          : retryHeader
            ? Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000)
            : 60;
      const retryAfter =
        rejected && response.status === 429
          ? Math.max(1, Math.min(Number.isFinite(seconds) ? seconds : 60, 86400))
          : null;
      throw new OpenRouterError(
        boundedProviderMessage(payload),
        response.ok ? 502 : response.status || 502,
        requestId,
        rejected,
        retryAfter,
      );
    }
    if (!Array.isArray(payload.choices) || !payload.choices[0]?.message) {
      throw new OpenRouterError(
        "OpenRouter returned no assistant message",
        502,
        (input.strictPricing && typeof payload.id === "string" ? payload.id : requestId) ||
          payload.id ||
          null,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      // A caller-cancelled request is not a provider failure and must not retry.
      if (input.signal?.aborted) throw new OpenRouterError("OpenRouter request was cancelled", 499);
      throw new OpenRouterError(`OpenRouter timed out after ${Date.now() - startedAt}ms`, 504);
    }
    throw new OpenRouterError(
      error instanceof Error ? boundedMessage(error.message) : "OpenRouter request failed",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve the serving model for a job through the registry and record the
 * receipt. The registry reads its default model id from the leaf
 * `openrouter-models` module, so this static import cannot cycle.
 */
async function resolveJobModel(
  input: OpenRouterRequest,
  explicitTenantId: string,
): Promise<{ requested: string; resolved: string }> {
  const jobKey = input.job?.trim();
  if (!jobKey) throw new OpenRouterError("AI calls must name a registered job", 400);
  if (!input.database)
    throw new OpenRouterError("AI calls require a tenant-bound database for model receipts", 400);
  const resolution = await resolveModelForJob(
    input.database,
    explicitTenantId,
    input.job,
    getOpenRouterModel(input.model),
  );
  const fallback = input.strictPricing ? null : getOpenRouterFallbackModel();
  if (fallback) await resolveModelForJob(input.database, explicitTenantId, input.job, fallback);
  return { requested: resolution.requested, resolved: resolution.resolved };
}

async function recordJobReceipt(
  input: OpenRouterRequest,
  tenantId: string,
  requested: string,
  resolved: string,
  startedAt: number,
  callId: string,
  phase: "started" | "completed" | "failed" | "cancelled" = "completed",
): Promise<void> {
  if (!input.database) throw new Error("Model receipt requires a database");
  await recordModelCall(input.database, {
    job: input.job,
    requested,
    resolved,
    tenantId,
    latencyMs: Date.now() - startedAt,
    callId,
    phase,
  });
}

function resolveJobTenant(input: OpenRouterRequest): string {
  const scoped = input.database ? tenantIdForDatabase(input.database) : undefined;
  if (scoped && input.tenantId && scoped !== input.tenantId)
    throw new OpenRouterError("Model attribution does not match the workspace", 400);
  const id = scoped ?? input.tenantId;
  if (!id) throw new OpenRouterError("AI calls must carry an owning tenant id", 400);
  return id;
}

export async function openRouterChat(input: OpenRouterRequest): Promise<OpenRouterResponse> {
  if (
    input.timeoutMs !== undefined &&
    (!Number.isFinite(input.timeoutMs) || input.timeoutMs < 1000 || input.timeoutMs > 180000)
  )
    throw new OpenRouterError("Inference timeout must be between 1 and 180 seconds", 400);
  if (
    input.strictPricing &&
    (!input.model?.trim() ||
      Object.values(input.strictPricing).some((price) => !Number.isFinite(price) || price < 0))
  )
    throw new OpenRouterError(
      "Strict pricing requires an explicit model and finite non-negative prices",
      400,
    );
  const apiKey = await requestApiKey(input);
  const tenantId = resolveJobTenant(input);
  const { requested, resolved: model } = await resolveJobModel(input, tenantId);
  const startedAt = Date.now();
  const callId = randomUUID();
  await recordJobReceipt(input, tenantId, requested, model, startedAt, callId, "started");
  let lastError: OpenRouterError | null = null;
  const attempts = input.strictPricing ? 1 : MAX_ATTEMPTS;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await input.beforeAttempt?.(attempt);
      const payload = await attemptChat(input, model, apiKey);
      await recordJobReceipt(input, tenantId, requested, payload.model ?? model, startedAt, callId);
      return payload;
    } catch (error) {
      if (!(error instanceof OpenRouterError)) {
        await recordJobReceipt(input, tenantId, requested, model, startedAt, callId, "failed");
        throw error;
      }
      lastError = error;
      const recoverable =
        isRetryableStatus(error.status) && attempt < attempts && !input.signal?.aborted;
      if (!recoverable) {
        await recordJobReceipt(
          input,
          tenantId,
          requested,
          model,
          startedAt,
          callId,
          input.signal?.aborted ? "cancelled" : "failed",
        );
        throw error;
      }
      await backoff(attempt);
    }
  }
  throw lastError ?? new OpenRouterError("OpenRouter request failed", 502);
}

type OpenRouterStreamChunk = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: OpenRouterUsage;
};

/**
 * Stream a tool-capable chat completion while reconstructing the same response
 * shape consumed by the bounded agent loop. Text deltas are observable, but
 * tool arguments stay server-side until the complete validated call exists.
 */
export async function openRouterChatStream(
  input: OpenRouterRequest,
  onTextDelta: (delta: string) => void,
): Promise<OpenRouterResponse> {
  if (input.strictPricing)
    throw new OpenRouterError("Strict budgeted calls require non-streaming execution", 400);
  const apiKey = await requestApiKey(input);
  const controller = new AbortController();
  const tenantId = resolveJobTenant(input);
  const { requested, resolved: model } = await resolveJobModel(input, tenantId);
  const streamStartedAt = Date.now();
  const callId = randomUUID();
  await recordJobReceipt(input, tenantId, requested, model, streamStartedAt, callId, "started");
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const fallbackModel = getOpenRouterFallbackModel();
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model,
        ...(fallbackModel && fallbackModel !== model
          ? { models: [model, fallbackModel], route: "fallback" }
          : {}),
        messages: input.messages,
        max_tokens: Math.min(Math.max(input.maxTokens ?? 1200, 1), 8000),
        temperature: input.temperature ?? 0.2,
        ...(input.tools?.length ? { tools: input.tools, tool_choice: "auto" } : {}),
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: combineSignals(controller.signal, input.signal),
    });
    const requestId = response.headers.get("x-request-id");
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null);
      throw new OpenRouterError(boundedProviderMessage(payload), response.status || 502, requestId);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let id = requestId || "streamed-openrouter-response";
    let resolvedModel = model;
    let content = "";
    let finishReason: string | null = null;
    let usage: OpenRouterUsage = {};
    const calls = new Map<number, OpenRouterToolCall>();

    const consume = (block: string) => {
      for (const line of block.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let chunk: OpenRouterStreamChunk;
        try {
          chunk = JSON.parse(raw) as OpenRouterStreamChunk;
        } catch {
          continue;
        }
        if (chunk.id) id = chunk.id;
        if (chunk.model) resolvedModel = chunk.model;
        if (chunk.usage) usage = chunk.usage;
        const choice = chunk.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const delta = choice?.delta;
        if (delta?.content) {
          content += delta.content;
          onTextDelta(delta.content);
        }
        for (const piece of delta?.tool_calls ?? []) {
          const current = calls.get(piece.index) ?? {
            id: piece.id || `tool-${piece.index}`,
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (piece.id) current.id = piece.id;
          if (piece.function?.name) current.function.name += piece.function.name;
          if (piece.function?.arguments) current.function.arguments += piece.function.arguments;
          calls.set(piece.index, current);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) consume(block);
    }
    if (buffer.trim()) consume(buffer);

    await recordJobReceipt(input, tenantId, requested, resolvedModel, streamStartedAt, callId);
    return {
      id,
      model: resolvedModel,
      usage,
      choices: [
        {
          finish_reason: finishReason,
          message: {
            role: "assistant",
            content: content || null,
            ...(calls.size
              ? {
                  tool_calls: [...calls.entries()]
                    .sort(([a], [b]) => a - b)
                    .map(([, call]) => call),
                }
              : {}),
          },
        },
      ],
    };
  } catch (error) {
    await recordJobReceipt(
      input,
      tenantId,
      requested,
      model,
      streamStartedAt,
      callId,
      input.signal?.aborted ? "cancelled" : "failed",
    );
    if (error instanceof OpenRouterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      if (input.signal?.aborted) throw new OpenRouterError("OpenRouter request was cancelled", 499);
      throw new OpenRouterError(
        `OpenRouter timed out after ${Date.now() - streamStartedAt}ms`,
        504,
      );
    }
    throw new OpenRouterError(
      error instanceof Error ? boundedMessage(error.message) : "OpenRouter stream failed",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function openRouterJson<T>(
  input: OpenRouterRequest & {
    schemaName: string;
    schema: Record<string, unknown>;
    validate: (value: unknown) => T;
  },
): Promise<{ data: T; requestId: string; model: string; usage: OpenRouterUsage }> {
  const response = await openRouterChat({
    ...input,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: input.schemaName, strict: true, schema: input.schema },
    },
  });
  if (response.choices[0]?.finish_reason === "length")
    throw new OpenRouterError(
      "AI output reached its token limit before completing. Request a shorter page or choose another model.",
      502,
      response.id,
    );
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new OpenRouterError("OpenRouter returned an empty structured response", 502, response.id);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new OpenRouterError("OpenRouter returned malformed structured JSON", 502, response.id);
  }
  try {
    return {
      data: input.validate(parsed),
      requestId: response.id,
      model: response.model,
      usage: response.usage ?? {},
    };
  } catch (error) {
    throw new OpenRouterError(
      error instanceof Error
        ? boundedMessage(error.message)
        : "OpenRouter returned an invalid structured payload",
      502,
      response.id,
    );
  }
}

/** Streams OpenRouter's OpenAI-compatible SSE response as plain text so the
 * existing website chat client keeps its small text-stream contract. */
export async function openRouterTextStream(
  input: Omit<OpenRouterRequest, "responseFormat" | "tools">,
  onMetadata?: (metadata: OpenRouterStreamMetadata) => void,
): Promise<ReadableStream<Uint8Array>> {
  if (input.strictPricing)
    throw new OpenRouterError("Strict budgeted calls require non-streaming execution", 400);
  const controller = new AbortController();
  const tenantId = resolveJobTenant(input);
  const { requested, resolved: model } = await resolveJobModel(input, tenantId);
  const streamStartedAt = Date.now();
  const callId = randomUUID();
  await recordJobReceipt(input, tenantId, requested, model, streamStartedAt, callId, "started");
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const fallbackModel = getOpenRouterFallbackModel();
  const apiKey = await requestApiKey(input);
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model,
        ...(fallbackModel && fallbackModel !== model
          ? { models: [model, fallbackModel], route: "fallback" }
          : {}),
        messages: input.messages,
        max_tokens: Math.min(Math.max(input.maxTokens ?? 500, 1), 2000),
        temperature: input.temperature ?? 0.6,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: combineSignals(controller.signal, input.signal),
    });
  } catch (error) {
    clearTimeout(timeout);
    await recordJobReceipt(
      input,
      tenantId,
      requested,
      model,
      streamStartedAt,
      callId,
      input.signal?.aborted ? "cancelled" : "failed",
    );
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterError(
        input.signal?.aborted
          ? "OpenRouter request was cancelled"
          : "OpenRouter timed out after 45000ms",
        input.signal?.aborted ? 499 : 504,
      );
    }
    throw new OpenRouterError(
      error instanceof Error ? boundedMessage(error.message) : "OpenRouter stream failed",
      502,
    );
  }
  if (!response.ok || !response.body) {
    clearTimeout(timeout);
    await recordJobReceipt(input, tenantId, requested, model, streamStartedAt, callId, "failed");
    const payload = await response.json().catch(() => null);
    throw new OpenRouterError(
      boundedProviderMessage(payload),
      response.status || 502,
      response.headers.get("x-request-id"),
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const metadata: OpenRouterStreamMetadata = {
    requestId: response.headers.get("x-request-id") || "streamed-openrouter-response",
    model,
    usage: {},
  };
  let metadataDelivered = false;
  const deliverMetadata = async (phase: "completed" | "failed" | "cancelled" = "completed") => {
    if (metadataDelivered) return;
    metadataDelivered = true;
    onMetadata?.({ ...metadata, usage: { ...metadata.usage } });
    await recordJobReceipt(
      input,
      tenantId,
      requested,
      metadata.model ?? model,
      streamStartedAt,
      callId,
      phase,
    );
  };
  return new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.trim()) parseSseChunk(buffer, streamController, encoder, metadata);
            await deliverMetadata();
            clearTimeout(timeout);
            streamController.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? "";
          for (const block of blocks) parseSseChunk(block, streamController, encoder, metadata);
          if (blocks.length) return;
        }
      } catch (error) {
        try {
          await deliverMetadata("failed");
        } finally {
          clearTimeout(timeout);
          streamController.error(error);
        }
      }
    },
    async cancel() {
      try {
        await deliverMetadata("cancelled");
      } finally {
        clearTimeout(timeout);
        controller.abort();
        await reader.cancel();
      }
    },
  });
}

function parseSseChunk(
  block: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  metadata: OpenRouterStreamMetadata,
) {
  for (const line of block.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let parsed: OpenRouterStreamChunk;
    try {
      parsed = JSON.parse(data) as OpenRouterStreamChunk;
    } catch {
      // Ignore non-JSON keepalive/provider metadata frames.
      continue;
    }
    if ("error" in parsed)
      throw new OpenRouterError(boundedProviderMessage(parsed), 502, metadata.requestId);
    if (parsed.id) metadata.requestId = parsed.id;
    if (parsed.model) metadata.model = parsed.model;
    if (parsed.usage) metadata.usage = parsed.usage;
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) controller.enqueue(encoder.encode(content));
  }
}

/** Read the provider's final charge for one stored generation; never starts inference. */
export async function getOpenRouterGeneration(database: SupabaseClient, generationId: string) {
  if (!/^gen-[a-zA-Z0-9_-]{1,196}$/.test(generationId))
    throw new Error("Stored generation ID is unavailable");
  const key = await requestApiKey({ database });
  const url = new URL("https://openrouter.ai/api/v1/generation");
  url.searchParams.set("id", generationId);
  const response = await fetch(url, {
    headers: headers(key),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new Error("Final provider usage is unavailable; reservation remains held");
  const parsed = z
    .object({
      data: z.object({
        id: z.string(),
        model: z.string().min(1).max(200),
        created_at: z.iso.datetime({ offset: true }),
        finish_reason: z.enum(["stop", "length", "tool_calls", "content_filter", "error"]),
        total_cost: z.number().finite().nonnegative(),
        native_tokens_prompt: z.number().int().nonnegative(),
        native_tokens_completion: z.number().int().nonnegative(),
      }),
    })
    .parse(await readBoundedJson(response, 32 * 1024));
  if (parsed.data.id !== generationId)
    throw new Error("Provider generation identity differs from the stored request");
  return parsed.data;
}
