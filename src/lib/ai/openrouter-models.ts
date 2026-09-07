import "server-only";

/**
 * Leaf module for OpenRouter model defaults. Kept free of domain imports:
 * both the gateway (`openrouter.ts`) and the job registry
 * (`model-registry.ts`) depend on these constants, so defining them here
 * avoids a gateway <-> registry import cycle (which would read the default
 * binding before its module body evaluates).
 */

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4.1-mini";

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
