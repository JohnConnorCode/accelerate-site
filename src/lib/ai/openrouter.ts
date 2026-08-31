import { tenant } from "@/config/tenant";
import "server-only";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4.1-mini";

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
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
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
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export function getOpenRouterModel(preferred?: string): string {
  return preferred?.trim() || process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

/**
 * A second model OpenRouter routes to when the primary is unavailable or
 * rate-limited. Optional: with none configured the behaviour is exactly as
 * before, a single-model request.
 */
export function getOpenRouterFallbackModel(): string | null {
  return process.env.OPENROUTER_FALLBACK_MODEL?.trim() || null;
}

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

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function headers(): HeadersInit {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new OpenRouterError("OpenRouter is not configured. Add OPENROUTER_API_KEY in Vercel.", 503);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || tenant.brand.siteUrl;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": siteUrl,
    "X-OpenRouter-Title": `${tenant.brand.name} Revenue OS`,
  };
}

function boundedProviderMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "OpenRouter request failed";
  const candidate = payload as { error?: { message?: unknown }; message?: unknown };
  const message = typeof candidate.error?.message === "string"
    ? candidate.error.message
    : typeof candidate.message === "string"
      ? candidate.message
      : "OpenRouter request failed";
  return message.replace(/(?:sk-or-v1-|Bearer\s+)[A-Za-z0-9._-]+/gi, "[redacted]").slice(0, 500);
}

async function attemptChat(input: OpenRouterRequest, model: string): Promise<OpenRouterResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const startedAt = Date.now();
  const fallbackModel = getOpenRouterFallbackModel();
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model,
        // Provider-side failover: OpenRouter tries the fallback itself if the
        // primary is down, which recovers faster than our own retry loop.
        ...(fallbackModel && fallbackModel !== model ? { models: [model, fallbackModel], route: "fallback" } : {}),
        messages: input.messages,
        max_tokens: Math.min(Math.max(input.maxTokens ?? 1200, 1), 8000),
        temperature: input.temperature ?? 0.2,
        ...(input.tools?.length ? { tools: input.tools, tool_choice: "auto" } : {}),
        ...(input.responseFormat ? {
          response_format: input.responseFormat,
          provider: { require_parameters: true },
        } : {}),
      }),
      signal: combineSignals(controller.signal, input.signal),
    });
    const requestId = response.headers.get("x-request-id");
    const payload = await response.json().catch(() => null) as OpenRouterResponse | null;
    if (!response.ok || !payload) {
      throw new OpenRouterError(boundedProviderMessage(payload), response.status || 502, requestId);
    }
    if (!Array.isArray(payload.choices) || !payload.choices[0]?.message) {
      throw new OpenRouterError("OpenRouter returned no assistant message", 502, requestId || payload.id || null);
    }
    return payload;
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      // A caller-cancelled request is not a provider failure and must not retry.
      if (input.signal?.aborted) throw new OpenRouterError("OpenRouter request was cancelled", 499);
      throw new OpenRouterError(`OpenRouter timed out after ${Date.now() - startedAt}ms`, 504);
    }
    throw new OpenRouterError(error instanceof Error ? error.message.slice(0, 500) : "OpenRouter request failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function openRouterChat(input: OpenRouterRequest): Promise<OpenRouterResponse> {
  const model = getOpenRouterModel(input.model);
  let lastError: OpenRouterError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await attemptChat(input, model);
    } catch (error) {
      if (!(error instanceof OpenRouterError)) throw error;
      lastError = error;
      const recoverable = isRetryableStatus(error.status) && attempt < MAX_ATTEMPTS && !input.signal?.aborted;
      if (!recoverable) throw error;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const model = getOpenRouterModel(input.model);
  const fallbackModel = getOpenRouterFallbackModel();
  const startedAt = Date.now();
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model,
        ...(fallbackModel && fallbackModel !== model ? { models: [model, fallbackModel], route: "fallback" } : {}),
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
        try { chunk = JSON.parse(raw) as OpenRouterStreamChunk; }
        catch { continue; }
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

    return {
      id,
      model: resolvedModel,
      usage,
      choices: [{
        finish_reason: finishReason,
        message: {
          role: "assistant",
          content: content || null,
          ...(calls.size ? { tool_calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call) } : {}),
        },
      }],
    };
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      if (input.signal?.aborted) throw new OpenRouterError("OpenRouter request was cancelled", 499);
      throw new OpenRouterError(`OpenRouter timed out after ${Date.now() - startedAt}ms`, 504);
    }
    throw new OpenRouterError(error instanceof Error ? error.message.slice(0, 500) : "OpenRouter stream failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function openRouterJson<T>(input: OpenRouterRequest & {
  schemaName: string;
  schema: Record<string, unknown>;
  validate: (value: unknown) => T;
}): Promise<{ data: T; requestId: string; model: string; usage: OpenRouterUsage }> {
  const response = await openRouterChat({
    ...input,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: input.schemaName, strict: true, schema: input.schema },
    },
  });
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
      error instanceof Error ? error.message.slice(0, 500) : "OpenRouter returned an invalid structured payload",
      502,
      response.id,
    );
  }
}

/** Streams OpenRouter's OpenAI-compatible SSE response as plain text so the
 * existing website chat client keeps its small text-stream contract. */
export async function openRouterTextStream(input: Omit<OpenRouterRequest, "responseFormat" | "tools">): Promise<ReadableStream<Uint8Array>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: getOpenRouterModel(input.model),
      messages: input.messages,
      max_tokens: Math.min(Math.max(input.maxTokens ?? 500, 1), 2000),
      temperature: input.temperature ?? 0.6,
      stream: true,
    }),
    signal: combineSignals(controller.signal, input.signal),
  });
  if (!response.ok || !response.body) {
    clearTimeout(timeout);
    const payload = await response.json().catch(() => null);
    throw new OpenRouterError(boundedProviderMessage(payload), response.status || 502, response.headers.get("x-request-id"));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.trim()) parseSseChunk(buffer, streamController, encoder);
            clearTimeout(timeout);
            streamController.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) parseSseChunk(block, streamController, encoder);
          if (blocks.length) return;
        }
      } catch (error) {
        clearTimeout(timeout);
        streamController.error(error);
      }
    },
    cancel() {
      clearTimeout(timeout);
      controller.abort();
      void reader.cancel();
    },
  });
}

function parseSseChunk(block: string, controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder) {
  for (const line of block.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string | null } }> };
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) controller.enqueue(encoder.encode(content));
    } catch {
      // Ignore non-JSON keepalive/provider metadata frames.
    }
  }
}
