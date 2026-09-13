import "server-only";

/**
 * Leaf module for OpenRouter model defaults. Kept free of domain imports:
 * both the gateway (`openrouter.ts`) and the job registry
 * (`model-registry.ts`) depend on these constants, so defining them here
 * avoids a gateway <-> registry import cycle (which would read the default
 * binding before its module body evaluates).
 */

/** Shared default for every OpenRouter-backed workflow. Callers may still
 * select a model explicitly, and OPENROUTER_MODEL remains an optional
 * installation override. */
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4.1-flash";

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
