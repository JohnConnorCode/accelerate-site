import { z } from "zod";

export const DEFAULT_SITE_MODEL = "meta/muse-spark-1.3";
export const SITE_MODEL_RECOMMENDATIONS = [
  DEFAULT_SITE_MODEL,
  "nex-agi/nex-n2.5-mini:free",
  "nex-agi/nex-n2.5-pro:free",
  "inception/mercury-2.5",
  "deepseek/deepseek-v4-flash-0731",
  "openai/gpt-5.6-luna",
  "google/gemini-3.8-flash",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5",
  "anthropic/claude-fable-5.1",
  "openai/gpt-6-astra",
];
export const siteModelIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\/[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,160}$/);
export const sitePriceCeilingSchema = z
  .object({
    prompt: z.number().finite().min(0).max(1000),
    completion: z.number().finite().min(0).max(1000),
    request: z.literal(0),
  })
  .strict();
export type SitePriceCeiling = z.infer<typeof sitePriceCeilingSchema>;
export type SiteReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";
export type SiteStudioModel = {
  id: string;
  label: string;
  provider: string;
  tier: "free" | "low" | "standard" | "premium";
  contextWindow: number;
  prompt: number;
  completion: number;
  request: 0;
  created: number;
  supportsTemperature: boolean;
  reasoningEffort?: SiteReasoningEffort;
};
const rawModel = z.object({
  id: siteModelIdSchema,
  name: z.string().min(1).max(200),
  created: z.number().int().nonnegative(),
  context_length: z.number().int().min(32000),
  architecture: z.object({
    input_modalities: z.array(z.string()),
    output_modalities: z.array(z.string()),
  }),
  supported_parameters: z.array(z.string()).max(100),
  pricing: z.object({ prompt: z.string(), completion: z.string(), request: z.string().optional() }),
  expiration_date: z.string().nullable().optional(),
  top_provider: z.object({ max_completion_tokens: z.number().nullable().optional() }).optional(),
  reasoning: z
    .object({
      mandatory: z.boolean().optional(),
      supported_efforts: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
});
/** Metadata is untrusted. Only text models with explicit structured-output support
 * and bounded, known token prices enter this generation catalogue. */
export function parseSiteModelCatalog(payload: unknown, now = Date.now()): SiteStudioModel[] {
  const envelope = z.object({ data: z.array(z.unknown()).max(5000) }).parse(payload);
  const result = new Map<string, SiteStudioModel>();
  for (const entry of envelope.data) {
    const parsed = rawModel.safeParse(entry);
    if (!parsed.success) continue;
    const m = parsed.data;
    if (/contributor/i.test(m.id) || (m.id.includes(":") && !m.id.endsWith(":free"))) continue;
    if (
      !m.architecture.input_modalities.includes("text") ||
      m.architecture.output_modalities.join() !== "text"
    )
      continue;
    if (
      !["structured_outputs", "response_format", "max_tokens"].every((p) =>
        m.supported_parameters.includes(p),
      )
    )
      continue;
    if (
      m.expiration_date &&
      (!Number.isFinite(Date.parse(m.expiration_date)) || Date.parse(m.expiration_date) <= now)
    )
      continue;
    if (
      m.top_provider?.max_completion_tokens != null &&
      m.top_provider.max_completion_tokens < 8000
    )
      continue;
    const amounts = [m.pricing.prompt, m.pricing.completion, m.pricing.request ?? "0"];
    if (amounts.some((value) => !/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) continue;
    const prompt = Number(m.pricing.prompt);
    const completion = Number(m.pricing.completion);
    const request = Number(m.pricing.request ?? "0");
    if (
      ![prompt, completion, request].every(Number.isFinite) ||
      prompt > 0.001 ||
      completion > 0.001 ||
      request !== 0
    )
      continue;
    const efforts = m.reasoning?.supported_efforts ?? [];
    const preference: SiteReasoningEffort[] = m.reasoning?.mandatory
      ? ["low", "minimal", "medium", "high"]
      : ["none", "low", "minimal", "medium", "high"];
    const reasoningEffort = m.supported_parameters.includes("reasoning")
      ? preference.find((e) => efforts.includes(e))
      : undefined;
    result.set(m.id, {
      id: m.id,
      label: m.name.replace(/^[^:]+:\s*/, ""),
      provider: m.id.slice(0, m.id.indexOf("/")),
      tier:
        prompt === 0 && completion === 0
          ? "free"
          : prompt * 1e6 <= 1 && completion * 1e6 <= 3
            ? "low"
            : completion * 1e6 >= 20
              ? "premium"
              : "standard",
      contextWindow: m.context_length,
      prompt: Number((prompt * 1e6).toFixed(8)),
      completion: Number((completion * 1e6).toFixed(8)),
      request: 0,
      created: m.created,
      supportsTemperature: m.supported_parameters.includes("temperature"),
      ...(reasoningEffort ? { reasoningEffort } : {}),
    });
  }
  if (!result.size) throw new Error("No compatible page models are available.");
  return [...result.values()].sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
}
export function modelPriceCeiling(model: SiteStudioModel): SitePriceCeiling {
  return { prompt: model.prompt, completion: model.completion, request: 0 };
}
export class SiteModelSelectionError extends Error {}
export function enforceSitePriceCeiling(model: SiteStudioModel, ceiling?: SitePriceCeiling) {
  const approved = ceiling ? sitePriceCeilingSchema.parse(ceiling) : modelPriceCeiling(model);
  if (model.prompt > approved.prompt || model.completion > approved.completion)
    throw new SiteModelSelectionError(
      "This model's price increased. Refresh models and review the new price before trying again.",
    );
  return modelPriceCeiling(model);
}

/** Recommend the newest compatible member of each useful family. This changes
 * the menu, never the user's selected model or the explicit Muse default. */
export function recommendedSiteModelIds(models: SiteStudioModel[]): string[] {
  const newest = [...models].sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
  const families = [
    /^nex-agi\/.*mini.*:free$/,
    /^nex-agi\/.*pro.*:free$/,
    /^inception\/mercury-/,
    /^deepseek\/.*flash(?!.*(?:vision|exp))/,
    /^openai\/gpt-[^/]*luna$/,
    /^google\/gemini-[^/]*flash$/,
    /^anthropic\/claude-sonnet-/,
    /^anthropic\/claude-opus-/,
    /^anthropic\/claude-fable-/,
    /^openai\/gpt-[^/]*astra$/,
  ];
  return [
    ...new Set(
      [
        DEFAULT_SITE_MODEL,
        ...families.map((pattern) => newest.find((model) => pattern.test(model.id))?.id),
      ].filter((id): id is string => Boolean(id) && models.some((model) => model.id === id)),
    ),
  ];
}
