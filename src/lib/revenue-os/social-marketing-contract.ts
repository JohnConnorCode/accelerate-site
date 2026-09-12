import { z } from "zod";
const source = z
  .object({
    title: z.string().trim().min(1).max(200),
    url: z.url().refine((v) => new URL(v).protocol === "https:"),
    excerpt: z.string().trim().min(1).max(2000),
  })
  .strict();
export const socialDraftSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(3000),
    channelId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    scheduledAt: z.iso.datetime({ offset: true }),
    timeZone: z
      .string()
      .refine(
        (value) => value === "UTC" || Intl.supportedValuesOf("timeZone").includes(value),
        "Use an IANA time zone",
      ),
    sources: z.array(source).min(1).max(5),
    mediaId: z.uuid().nullable(),
  })
  .strict();
export const socialChangeSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("reconcile"),
      attemptId: z.uuid(),
      providerPostId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    })
    .strict(),
  z
    .object({ operation: z.literal("save"), drafts: z.array(socialDraftSchema).min(1).max(3) })
    .strict(),
  z
    .object({
      operation: z.literal("schedule"),
      posts: z
        .array(z.object({ id: z.uuid(), revision: z.number().int().positive() }).strict())
        .min(1)
        .max(10),
    })
    .strict(),
  z
    .object({
      operation: z.literal("cancel"),
      posts: z
        .array(z.object({ id: z.uuid(), revision: z.number().int().positive() }).strict())
        .min(1)
        .max(10),
    })
    .strict(),
]);
export const socialPreviewSchema = z
  .object({ operationId: z.uuid(), change: socialChangeSchema })
  .strict();
export const socialProposalSchema = socialPreviewSchema.extend({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const socialReadSchema = z
  .object({ limit: z.number().int().min(1).max(100).default(50) })
  .strict();
export const socialWeeklySchema = z
  .object({
    source: source,
    channelId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    weekStart: z.iso.datetime({ offset: true }),
    timeZone: socialDraftSchema.shape.timeZone,
  })
  .strict();
