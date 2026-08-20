#!/usr/bin/env tsx
/**
 * Proves the OpenRouter gateway actually reaches the provider on every code path
 * the product uses.
 *
 * This exists because `agent_runs` was empty in production: the copilot had never
 * run, so nothing had ever confirmed that the AI works at all. A gateway that has
 * never been called is a guess, not a capability.
 *
 * It exercises all four paths and reports the resolved model, provider request
 * id, token usage, and latency for each:
 *   1. plain completion        (insights, health check)
 *   2. strict structured JSON  (content briefs, proposals, plan, contact import)
 *   3. tool calling            (the Revenue Copilot — the only tool-using path)
 *   4. token streaming         (the public website chat)
 *
 * The key lives only in Vercel, so this reads the pulled production env file.
 * Requests are deliberately tiny; the whole run costs a fraction of a cent.
 */
import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModel,
  isOpenRouterConfigured,
  openRouterChat,
  openRouterJson,
  openRouterTextStream,
  type OpenRouterTool,
} from "../src/lib/ai/openrouter";

type Result = {
  surface: string;
  ok: boolean;
  model?: string;
  requestId?: string | null;
  tokens?: number;
  ms: number;
  detail?: string;
};

const results: Result[] = [];

async function probe(surface: string, run: () => Promise<Omit<Result, "surface" | "ok" | "ms">>) {
  const startedAt = Date.now();
  try {
    const outcome = await run();
    results.push({ surface, ok: true, ms: Date.now() - startedAt, ...outcome });
  } catch (error) {
    results.push({
      surface, ok: false, ms: Date.now() - startedAt,
      detail: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
  }
}

const ECHO_TOOL: OpenRouterTool = {
  type: "function",
  function: {
    name: "record_pipeline_note",
    description: "Record a short note about a sales opportunity. Call this when asked to note something.",
    parameters: {
      type: "object",
      properties: { note: { type: "string", description: "The note to record" } },
      required: ["note"],
      additionalProperties: false,
    },
  },
};

async function main() {
  if (!isOpenRouterConfigured()) {
    console.error("OPENROUTER_API_KEY is not set. This script reads .vercel/.env.production.local;");
    console.error("run `vercel pull --yes --environment=production` if that file is stale or missing.");
    process.exit(1);
  }

  // 1. Plain completion.
  await probe("chat.plain", async () => {
    const response = await openRouterChat({
      maxTokens: 5, temperature: 0,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
    });
    const text = response.choices[0]?.message.content ?? "";
    if (!text.trim()) throw new Error("empty completion");
    return { model: response.model, requestId: response.id, tokens: response.usage?.total_tokens };
  });

  // 2. Strict structured output. This is the path every generative feature uses,
  //    and the one where a provider that ignores json_schema fails loudly.
  await probe("json.structured", async () => {
    const { data, requestId, model, usage } = await openRouterJson<{ stage: string; confident: boolean }>({
      maxTokens: 60, temperature: 0,
      messages: [{
        role: "user",
        content: "A prospect just asked for pricing after a demo. Classify the deal stage as one of: new, qualified, proposal.",
      }],
      schemaName: "stage_classification",
      schema: {
        type: "object",
        properties: { stage: { type: "string" }, confident: { type: "boolean" } },
        required: ["stage", "confident"],
        additionalProperties: false,
      },
      validate: (value) => {
        const candidate = value as { stage?: unknown; confident?: unknown };
        if (typeof candidate.stage !== "string") throw new Error("stage missing from structured output");
        if (typeof candidate.confident !== "boolean") throw new Error("confident missing from structured output");
        return { stage: candidate.stage, confident: candidate.confident };
      },
    });
    return { model, requestId, tokens: usage.total_tokens, detail: `stage=${data.stage}` };
  });

  // 3. Tool calling. If this fails the copilot cannot work at all, regardless of
  //    how good the registry is.
  await probe("chat.tools", async () => {
    const response = await openRouterChat({
      maxTokens: 80, temperature: 0,
      tools: [ECHO_TOOL],
      messages: [
        { role: "system", content: "You use tools when they fit the request." },
        { role: "user", content: "Please record a note that Ridgeline Roofing asked about pricing." },
      ],
    });
    const calls = response.choices[0]?.message.tool_calls ?? [];
    if (!calls.length) throw new Error("model returned no tool call, so the copilot loop cannot function");
    if (calls[0]?.function.name !== ECHO_TOOL.function.name) throw new Error(`unexpected tool ${calls[0]?.function.name}`);
    JSON.parse(calls[0].function.arguments); // must be parseable, the agent assumes this
    return { model: response.model, requestId: response.id, tokens: response.usage?.total_tokens, detail: `tool=${calls[0].function.name}` };
  });

  // 4. Streaming, the public website chat path.
  await probe("stream.text", async () => {
    const stream = await openRouterTextStream({
      maxTokens: 20, temperature: 0,
      messages: [{ role: "user", content: "Say hello in five words or fewer." }],
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    if (!text.trim()) throw new Error("stream produced no text");
    return { detail: `streamed ${text.trim().length} chars` };
  });

  const surfaceModels = {
    default: DEFAULT_OPENROUTER_MODEL,
    resolved: getOpenRouterModel(),
    agent: getOpenRouterModel(process.env.OPENROUTER_AGENT_MODEL),
    chat: getOpenRouterModel(process.env.OPENROUTER_CHAT_MODEL),
    plan: getOpenRouterModel(process.env.OPENROUTER_PLAN_MODEL),
    insights: getOpenRouterModel(process.env.OPENROUTER_INSIGHTS_MODEL),
    content: getOpenRouterModel(process.env.OPENROUTER_CONTENT_MODEL),
    proposal: getOpenRouterModel(process.env.OPENROUTER_PROPOSAL_MODEL),
    contactImport: getOpenRouterModel(process.env.OPENROUTER_IMPORT_MODEL),
  };
  const distinct = new Set(Object.values(surfaceModels));

  console.log(JSON.stringify({
    surfaceModels,
    distinctModelsInUse: distinct.size,
    results,
    totalTokens: results.reduce((sum, item) => sum + (item.tokens ?? 0), 0),
    result: results.every((item) => item.ok) ? "passed" : "failed",
  }, null, 2));

  if (distinct.size === 1) {
    console.log(`\nNote: every surface resolves to ${surfaceModels.resolved}. The public marketing chat and the tool-calling copilot run on the same model.`);
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    console.error(`\nAI gateway verification failed ${failed.length} of ${results.length} probe(s):`);
    for (const item of failed) console.error(`- ${item.surface}: ${item.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("AI gateway verification errored:", error instanceof Error ? error.message : error);
  process.exit(1);
});
