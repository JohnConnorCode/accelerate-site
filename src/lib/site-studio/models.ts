/** Provider IDs/capabilities and price ceilings verified against OpenRouter's
 * public model catalog on 2026-09-09. No Contributor/data-sharing tier is selected.
 * Prices are USD per million tokens; provider routing enforces these ceilings. */
export const DEFAULT_SITE_MODEL = "meta/muse-spark-1.3";
export const SITE_STUDIO_MODELS = [
  {
    id: DEFAULT_SITE_MODEL,
    label: "Muse Spark 1.3",
    tier: "standard",
    contextWindow: 1048576,
    prompt: 1.25,
    completion: 4.25,
  },
  {
    id: "nex-agi/nex-n2.5-mini:free",
    label: "Nex N2.5 Mini",
    tier: "free",
    contextWindow: 262144,
    prompt: 0,
    completion: 0,
  },
  {
    id: "inception/mercury-2.5",
    label: "Mercury 2.5",
    tier: "low",
    contextWindow: 260000,
    prompt: 0.04,
    completion: 0.15,
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    tier: "standard",
    contextWindow: 1000000,
    prompt: 3,
    completion: 15,
  },
  {
    id: "anthropic/claude-opus-4.6",
    label: "Claude Opus 4.6",
    tier: "premium",
    contextWindow: 1000000,
    prompt: 5,
    completion: 25,
  },
] as const;
export function siteModel(id: string) {
  const model = SITE_STUDIO_MODELS.find((model) => model.id === id);
  if (!model) throw new Error("Choose a supported Site Studio model.");
  return model;
}
