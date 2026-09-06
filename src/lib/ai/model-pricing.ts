import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readBoundedJson } from "./bounded-json";

const price = z
  .string()
  .regex(/^\d+(?:\.\d+)?$/)
  .transform(Number)
  .refine(Number.isFinite);
const modelSchema = z.object({
  id: z.string().min(1).max(200),
  context_length: z.number().int().positive(),
  supported_parameters: z.array(z.string()),
  pricing: z.object({ prompt: price, completion: price, request: price }).catchall(price),
});
export type ModelQuote = {
  model: string;
  promptPerMillion: number;
  completionPerMillion: number;
  request: number;
  context: number;
  jsonSchema: boolean;
  observedAt: string;
  fingerprint: string;
};
const quotes = new Map<string, ModelQuote>();
/** Public metadata only; no tenant data, prompt, credential or generated text is cached here. */
export async function getOpenRouterQuote(model: string): Promise<ModelQuote> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{1,199}$/.test(model)) throw new Error("Invalid model ID");
  const cached = quotes.get(model);
  if (cached && Date.now() - Date.parse(cached.observedAt) < 60_000) return cached;
  const url = new URL("https://openrouter.ai/api/v1/models");
  url.searchParams.set("q", model);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Model pricing is unavailable");
  const payload = z
    .object({ data: z.array(z.unknown()).max(5000) })
    .parse(await readBoundedJson(response, 4 * 1024 * 1024));
  const raw = payload.data.find(
    (value) => typeof value === "object" && value !== null && "id" in value && value.id === model,
  );
  const parsed = modelSchema.parse(raw);
  // Cache discounts may never exceed the full input-token reservation. Refuse
  // every other nonzero fee until the shared adapter accounts for that unit.
  for (const [key, amount] of Object.entries(parsed.pricing)) {
    if (["prompt", "completion", "request"].includes(key)) continue;
    if (["input_cache_read", "input_cache_write"].includes(key) && amount <= parsed.pricing.prompt)
      continue;
    if (amount !== 0) throw new Error("Model has an unsupported additional fee");
  }
  const amounts = [parsed.pricing.prompt, parsed.pricing.completion, parsed.pricing.request];
  if (amounts.some((value) => value > 1))
    throw new Error("Model pricing exceeds the supported low-cost range");
  const quote = {
    model,
    promptPerMillion: parsed.pricing.prompt * 1e6,
    completionPerMillion: parsed.pricing.completion * 1e6,
    request: parsed.pricing.request,
    context: parsed.context_length,
    jsonSchema:
      parsed.supported_parameters.includes("structured_outputs") ||
      parsed.supported_parameters.includes("response_format"),
    observedAt: new Date().toISOString(),
    fingerprint: createHash("sha256").update(JSON.stringify(parsed)).digest("hex"),
  };
  // This is a bounded catalog cache, never a tenant response cache.
  if (quotes.size >= 100) quotes.delete(quotes.keys().next().value!);
  quotes.set(model, quote);
  return quote;
}
