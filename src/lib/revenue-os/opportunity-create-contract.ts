import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

/** Shared by the canonical writer and fictional demo. A key identifies an intent,
 * not a customer: separate opportunities may have identical business details. */
export const opportunityCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: optionalText(100),
    companyName: optionalText(200),
    website: optionalText(500),
    industry: optionalText(100),
    opportunityName: optionalText(200),
    estimatedValue: z
      .number()
      .finite()
      .min(0)
      .max(1_000_000_000)
      .nullish()
      .transform((value) => value ?? 0),
    nextAction: optionalText(500),
    nextActionAt: optionalText(100).refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      "Invalid next action date",
    ),
    source: z
      .string()
      .regex(/^[a-z][a-z0-9_-]{0,79}$/)
      .default("manual"),
  })
  .strict();

export const opportunityCreateRequestSchema = opportunityCreateSchema
  .omit({ source: true })
  .extend({
    requestId: z.uuid(),
    estimatedValue: z.coerce.number().finite().min(0).max(1_000_000_000).default(0),
  });
