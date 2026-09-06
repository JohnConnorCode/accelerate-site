/** Public setup data only. Source facts, relationships and credentials live in
 * their canonical stores, never in tenant module settings. */
import { z } from "zod";
import type { ModuleSettingField } from "./modules";
const text = z.string().trim().max(2000);
const website = z.union([
  z.literal(""),
  z
    .url()
    .max(2000)
    .refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    }, "Use a public HTTPS website without credentials"),
]);
export const radarProfileSchema = z
  .object({
    organization: text,
    website,
    spokesperson: text,
    mission: text,
    expertise: text,
    audiences: text,
    topics: text,
    ownedAssets: text,
    region: text,
    timeZone: z
      .string()
      .max(100)
      .refine(
        (value) => value === "UTC" || Intl.supportedValuesOf("timeZone").includes(value),
        "Use a supported IANA time zone",
      ),
    dailyShortlist: z.number().int().min(1).max(10),
    maxDiscoveries: z.number().int().min(1).max(500),
    dailyModelBudgetUsd: z.number().min(0).max(100),
    modelMode: z.enum(["off", "free-only", "budgeted-low-cost"]),
    preferredModel: text,
    maxModelCallsPerDay: z.number().int().min(0).max(20),
    maxInputTokensPerCall: z.number().int().min(1024).max(16000),
    maxOutputTokensPerCall: z.number().int().min(256).max(4000),
    maxCostPerRunUsd: z.number().min(0).max(1),
    sourceMode: z.literal("free-first"),
    outreachMode: z.literal("draft-only"),
  })
  .strict();
export type RadarProfile = z.infer<typeof radarProfileSchema>;
export const RADAR_PROFILE_DEFAULTS: RadarProfile = {
  organization: "",
  website: "",
  spokesperson: "",
  mission: "",
  expertise: "",
  audiences: "",
  topics: "",
  ownedAssets: "",
  region: "",
  timeZone: "UTC",
  dailyShortlist: 5,
  maxDiscoveries: 50,
  dailyModelBudgetUsd: 0,
  modelMode: "off",
  preferredModel: "",
  maxModelCallsPerDay: 0,
  maxInputTokensPerCall: 8000,
  maxOutputTokensPerCall: 1000,
  maxCostPerRunUsd: 0,
  sourceMode: "free-first",
  outreachMode: "draft-only",
};
export const RADAR_PROFILE_FIELDS: ModuleSettingField[] = [
  ...(
    [
      ["organization", "Organization", "Your public business or project name."],
      [
        "website",
        "Website",
        "Your public HTTPS website. This setting does not authorize fetching URLs.",
      ],
      [
        "spokesperson",
        "Spokesperson",
        "Optional public representative; leave blank for organization-only work.",
      ],
      ["mission", "Mission and offer", "What you do and the useful contribution you can make."],
      [
        "expertise",
        "Earned expertise",
        "Firsthand experience you can substantiate; do not enter unsupported credentials.",
      ],
      [
        "audiences",
        "Business audiences",
        "The customers, professional communities or institutions you serve.",
      ],
      [
        "topics",
        "Topics",
        "Business topics to watch. Public affairs requires separate neutral review, not growth scoring.",
      ],
      [
        "ownedAssets",
        "Public assets",
        "Public URLs/descriptions, one per line. These are owned resources, not independent coverage.",
      ],
      ["region", "Region", "Geographic focus, or leave blank for no regional restriction."],
      [
        "timeZone",
        "Time zone",
        "IANA time zone, such as America/Chicago. Scheduling is not active in this foundation.",
      ],
    ] as const
  ).map(([key, label, description]) => ({
    key,
    label,
    description,
    type: key === "website" ? ("url" as const) : ("string" as const),
    default: RADAR_PROFILE_DEFAULTS[key],
  })),
  {
    key: "dailyShortlist",
    label: "Daily shortlist limit",
    description: "Maximum recommendations for future daily selection.",
    type: "number",
    min: 1,
    max: 10,
    default: 5,
  },
  {
    key: "maxDiscoveries",
    label: "Daily discovery limit",
    description: "Future worker cap; this does not start discovery.",
    type: "number",
    min: 1,
    max: 500,
    default: 50,
  },
  {
    key: "dailyModelBudgetUsd",
    label: "Daily model budget (USD)",
    description:
      "Zero disables automatic model spending. Model jobs must reserve the budget before calls.",
    type: "number",
    min: 0,
    max: 100,
    default: 0,
  },
  {
    key: "modelMode",
    label: "Model spending mode",
    type: "enum",
    options: ["off", "free-only", "budgeted-low-cost"],
    default: "off",
    description:
      "Applies to source briefing jobs. Off makes no model calls; free-only must never fall back to paid models.",
  },
  {
    key: "preferredModel",
    label: "Preferred registered model",
    type: "string",
    default: "",
    description:
      "Explicit model ID from the shared evaluated model registry. OpenRouter is the current transport; no premium default or invented model IDs.",
  },
  {
    key: "maxModelCallsPerDay",
    label: "Daily model call limit",
    type: "number",
    min: 0,
    max: 20,
    default: 0,
    description:
      "Independent call cap, including free models and retries. Zero disables automatic model calls.",
  },
  {
    key: "maxInputTokensPerCall",
    label: "Input token limit per call",
    type: "number",
    min: 1024,
    max: 16000,
    default: 8000,
    description: "Bound retrieved evidence before a model request.",
  },
  {
    key: "maxOutputTokensPerCall",
    label: "Output token limit per call",
    type: "number",
    min: 256,
    max: 4000,
    default: 1000,
    description: "Short structured results; no unbounded drafting loops.",
  },
  {
    key: "maxCostPerRunUsd",
    label: "Maximum cost per run (USD)",
    type: "number",
    min: 0,
    max: 1,
    default: 0,
    description: "Model jobs reserve worst-case cost before requests; zero allows no paid request.",
  },
  {
    key: "sourceMode",
    label: "Source mode",
    type: "enum",
    options: ["free-first"],
    default: "free-first",
    description: "No paid-source activation. Available public sources still have usage limits.",
  },
  {
    key: "outreachMode",
    label: "Outreach mode",
    type: "enum",
    options: ["draft-only"],
    default: "draft-only",
    description: "No sending or publication is enabled by setup.",
  },
];
export function radarProfileReadiness(raw: unknown) {
  const profile = radarProfileSchema.parse(raw);
  const missing = (
    ["organization", "website", "mission", "expertise", "audiences"] as const
  ).filter((key) => !profile[key]);
  return {
    profile,
    ready: missing.length === 0,
    missing,
    capabilities: {
      profileConfiguration: true,
      automaticDiscovery: false,
      outreachSending: false,
      publication: false,
    },
  };
}
