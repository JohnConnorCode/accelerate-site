import { z } from "zod";
import { isSiteContentHref } from "./links";
import {
  homeStatementContent,
  homeHeroContent,
  homeMarqueeContent,
  homeProcessContent,
  homeWhoContent,
  homeFaqContent,
  homeFinalCtaContent,
  homeSystemsContent,
  homeTradesContent,
  homePlanContent,
  homeWorkContent,
  homeCommandCenterContent,
} from "@/content/site-studio/home";

const text = z.string().min(1).max(2000);
const label = z.string().min(1).max(160);
const href = z.string().max(1000).refine(isSiteContentHref, "Use a safe website link");
export const homeStatementSchema = z
  .object({
    eyebrow: label,
    heading: text,
    body: text,
    systemsLabel: label,
    systemsHref: href,
    workLabel: label,
    workHref: href,
    productLabel: label,
    productHref: href,
  })
  .strict();
export const homeWhoSchema = z
  .object({
    eyebrow: label,
    headingStart: label,
    headingMiddle: label,
    headingEnd: label,
    years: z.string().regex(/^\d{1,3}$/),
    yearsLabel: label,
    body: text,
    detail: text,
    linkLabel: label,
    linkHref: href,
  })
  .strict();
export const homeFaqSchema = z
  .object({
    eyebrow: label,
    title: label,
    questions: z.array(z.string().min(1).max(300)).min(1).max(30),
    answers: z.array(text).min(1).max(30),
  })
  .strict()
  .refine(
    (value) => value.questions.length === value.answers.length,
    "Each FAQ needs both a question and an answer",
  );

export const homeHeroSchema = z
  .object({
    eyebrow: label,
    prefix: label,
    highlighted: label,
    suffix: label,
    replacedWord: label,
    finalWord: label,
    ctaLabel: label,
    ctaHref: href,
  })
  .strict();
export const homeMarqueeSchema = z.object({ items: z.array(label).min(1).max(30) }).strict();
export const homeProcessSchema = z
  .object({
    eyebrow: label,
    headingStart: label,
    headingMiddle: label,
    headingEnd: label,
    body: text,
    steps: z
      .array(
        z.object({ n: z.string().min(1).max(10), title: label, tag: label, body: text }).strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export const homeFinalCtaSchema = z
  .object({
    eyebrow: label,
    headingStart: label,
    headingEnd: label,
    body: text,
    ctaLabel: label,
    ctaHref: href,
  })
  .strict();
export const homeSystemsSchema = z
  .object({
    eyebrow: label,
    headingStart: label,
    headingMiddle: label,
    headingEnd: label,
    body: text,
    listLabel: label,
    note: text,
    modes: z
      .array(
        z
          .object({
            key: z.enum(["strategy", "build", "execute", "improve"]),
            label,
            title: label,
            description: text,
            example: text,
            href,
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export type HomeFinalCtaContent = z.infer<typeof homeFinalCtaSchema>;
export type HomeSystemsContent = z.infer<typeof homeSystemsSchema>;

export const homeTradesSchema = z
  .object({
    eyebrow: label,
    headingStart: label,
    headingMiddle: label,
    headingEnd: label,
    trades: z
      .array(
        z
          .object({
            href,
            name: label,
            promise: text,
            image: href.refine((value) => !value.startsWith("#")),
            alt: label,
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export const homeWorkSchema = z
  .object({ eyebrow: label, heading: text, body: text, ctaLabel: label, ctaHref: href })
  .strict();
export const homePlanDeckSchema = z
  .object({
    label,
    business: label,
    swipeLabel: label,
    pages: z
      .array(
        z
          .object({
            title: label,
            sub: text,
            note: text,
            rows: z
              .array(
                z
                  .object({
                    label,
                    value: label,
                    detail: text.optional(),
                    tail: label.optional(),
                    mute: z.boolean().optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type HomePlanDeckContent = z.infer<typeof homePlanDeckSchema>;
const screenshotSchema = z
  .object({
    kind: z.literal("image"),
    src: href.refine((value) => !value.startsWith("#")),
    alt: text,
    caption: text,
    width: z.number().int().positive().max(20000),
    height: z.number().int().positive().max(20000),
    presentation: z.enum(["interface", "photo", "slide"]),
    fit: z.enum(["cover", "contain"]).optional(),
    canvas: z.enum(["paper", "ink"]).optional(),
    objectPosition: z
      .string()
      .regex(
        /^(?:left|center|right|top|bottom|[0-9]{1,3}%)(?: (?:left|center|right|top|bottom|[0-9]{1,3}%))?$/,
      )
      .optional(),
    demoHref: href,
  })
  .strict();
export const homePlanSchema = homeWorkSchema.extend({
  deck: homePlanDeckSchema,
  items: z.array(text).min(1).max(30),
});
export const homeCommandCenterSchema = z
  .object({
    eyebrow: label,
    headingStart: label,
    headingEnd: label,
    body: text,
    introduction: text,
    groupLabel: label,
    slides: z.array(screenshotSchema).min(1).max(30),
    links: z.array(z.object({ label, href }).strict()).min(1).max(10),
  })
  .strict();
export type HomeTradesContent = z.infer<typeof homeTradesSchema>;
export type HomePlanContent = z.infer<typeof homePlanSchema>;
export type HomeWorkContent = z.infer<typeof homeWorkSchema>;
export type HomeCommandCenterContent = z.infer<typeof homeCommandCenterSchema>;

/** Explicit registry: a stored template name can only select reviewed source
 * components. Adding a template requires its schema, seed and renderer together. */
export const nativeTemplateSchemas: Record<string, z.ZodType> = {
  "home-hero": homeHeroSchema,
  "home-marquee": homeMarqueeSchema,
  "home-process": homeProcessSchema,
  "home-statement": homeStatementSchema,
  "home-who": homeWhoSchema,
  "home-faq": homeFaqSchema,
  "home-final-cta": homeFinalCtaSchema,
  "home-systems": homeSystemsSchema,
  "home-command-center": homeCommandCenterSchema,
  "home-work": homeWorkSchema,
  "home-plan": homePlanSchema,
  "home-trades": homeTradesSchema,
};
export const nativeTemplateDefaults = {
  "home-hero": homeHeroContent,
  "home-marquee": homeMarqueeContent,
  "home-process": homeProcessContent,
  "home-statement": homeStatementContent,
  "home-who": homeWhoContent,
  "home-faq": homeFaqContent,
  "home-final-cta": homeFinalCtaContent,
  "home-systems": homeSystemsContent,
  "home-command-center": homeCommandCenterContent,
  "home-work": homeWorkContent,
  "home-plan": homePlanContent,
  "home-trades": homeTradesContent,
};
export type HomeStatementContent = z.infer<typeof homeStatementSchema>;
export type HomeWhoContent = z.infer<typeof homeWhoSchema>;
export type HomeFaqContent = z.infer<typeof homeFaqSchema>;

export type HomeHeroContent = z.infer<typeof homeHeroSchema>;
export type HomeMarqueeContent = z.infer<typeof homeMarqueeSchema>;
export type HomeProcessContent = z.infer<typeof homeProcessSchema>;
