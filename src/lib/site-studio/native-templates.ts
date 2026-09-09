import { z } from "zod";
import { isSiteContentHref } from "./links";
import {
  homeStatementContent,
  homeHeroContent,
  homeMarqueeContent,
  homeProcessContent,
  homeWhoContent,
  homeFaqContent,
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

/** Explicit registry: a stored template name can only select reviewed source
 * components. Adding a template requires its schema, seed and renderer together. */
export const nativeTemplateSchemas: Record<string, z.ZodType> = {
  "home-hero": homeHeroSchema,
  "home-marquee": homeMarqueeSchema,
  "home-process": homeProcessSchema,
  "home-statement": homeStatementSchema,
  "home-who": homeWhoSchema,
  "home-faq": homeFaqSchema,
};
export const nativeTemplateDefaults = {
  "home-hero": homeHeroContent,
  "home-marquee": homeMarqueeContent,
  "home-process": homeProcessContent,
  "home-statement": homeStatementContent,
  "home-who": homeWhoContent,
  "home-faq": homeFaqContent,
};
export type HomeStatementContent = z.infer<typeof homeStatementSchema>;
export type HomeWhoContent = z.infer<typeof homeWhoSchema>;
export type HomeFaqContent = z.infer<typeof homeFaqSchema>;

export type HomeHeroContent = z.infer<typeof homeHeroSchema>;
export type HomeMarqueeContent = z.infer<typeof homeMarqueeSchema>;
export type HomeProcessContent = z.infer<typeof homeProcessSchema>;
