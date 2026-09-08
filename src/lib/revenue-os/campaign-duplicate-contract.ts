import { z } from "zod";

export class CampaignSourceChangedError extends Error {
  constructor() {
    super("Campaign source version changed; review the current source");
    this.name = "CampaignSourceChangedError";
  }
}

export const campaignDuplicateOptions = z
  .object({
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    name: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
export type CampaignDuplicateOptions = z.infer<typeof campaignDuplicateOptions>;

/** A draft has an explicit allowlist; delivery state never carries over. */
export function campaignDraftCopy<
  T extends {
    id: string;
    name: string;
    version: number;
    channel?: string;
    sender_name?: string | null;
    sender_email?: string | null;
    audience_definition?: Record<string, unknown>;
    policy: Record<string, unknown>;
    campaign_steps: Array<{
      step_order: number;
      delay_days: number;
      subject_template: string;
      body_template?: string;
      active?: boolean;
    }>;
  },
>(source: T, id: string, name?: string) {
  return {
    id,
    name: name ?? `${Array.from(source.name).slice(0, 193).join("")} (copy)`,
    channel: source.channel ?? "email",
    status: "draft",
    version: 1,
    approved_version: null,
    approved_at: null,
    approved_by: null,
    sender_name: source.sender_name ?? null,
    sender_email: source.sender_email ?? null,
    audience_definition: structuredClone(source.audience_definition ?? {}),
    policy: structuredClone(source.policy),
    stats: { duplicated_from: source.id, duplicated_from_version: source.version },
    campaign_steps: source.campaign_steps.map((step) => ({
      id: crypto.randomUUID(),
      campaign_id: id,
      step_order: step.step_order,
      delay_days: step.delay_days,
      subject_template: step.subject_template,
      body_template: step.body_template ?? "",
      active: step.active ?? true,
    })),
    campaign_members: [],
    created_at: new Date().toISOString(),
  };
}
