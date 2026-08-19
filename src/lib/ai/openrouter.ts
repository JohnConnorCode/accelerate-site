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

export async function openRouterChat(input: OpenRouterRequest): Promise<OpenRouterResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const startedAt = Date.now();
  const model = getOpenRouterModel(input.model);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model,
        messages: input.messages,
        max_tokens: Math.min(Math.max(input.maxTokens ?? 1200, 1), 8000),
        temperature: input.temperature ?? 0.2,
        ...(input.tools?.length ? { tools: input.tools, tool_choice: "auto" } : {}),
        ...(input.responseFormat ? {
          response_format: input.responseFormat,
          provider: { require_parameters: true },
        } : {}),
      }),
      signal: input.signal ?? controller.signal,
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
      throw new OpenRouterError(`OpenRouter timed out after ${Date.now() - startedAt}ms`, 504);
    }
    throw new OpenRouterError(error instanceof Error ? error.message.slice(0, 500) : "OpenRouter request failed", 502);
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
  return {
    data: input.validate(parsed),
    requestId: response.id,
    model: response.model,
    usage: response.usage ?? {},
  };
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
    signal: input.signal ?? controller.signal,
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
