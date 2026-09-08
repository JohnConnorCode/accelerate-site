import { z } from "zod";

/** Site Studio document model v1. The stored page is validated data, never
 * executable code. See docs/planning/SITE-STUDIO.md section 3. */

export const SITE_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const SITE_DOCUMENT_ENGINE = "site-studio" as const;
export const SITE_DOCUMENT_ENGINE_VERSION = 1 as const;

const nodeId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Node ids use lowercase letters, digits, and hyphens");

const href = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (value) => value.startsWith("/") || value.startsWith("https://"),
    "Links must be site-relative paths or https URLs",
  );

export const siteStyleSchema = z
  .object({
    background: z.enum(["surface", "surfaceDark", "accent", "transparent"]).optional(),
    paddingTop: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
    paddingBottom: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
    maxWidth: z.enum(["narrow", "content", "wide", "full"]).optional(),
    gap: z.enum(["sm", "md", "lg"]).optional(),
    align: z.enum(["start", "center"]).optional(),
    tone: z.enum(["default", "muted", "inverse"]).optional(),
  })
  .strict();
export type SiteStyles = z.infer<typeof siteStyleSchema>;

const ctaSchema = z
  .object({ label: z.string().min(1).max(60), href })
  .strict();
export type SiteCta = z.infer<typeof ctaSchema>;

const heroSchema = z
  .object({
    variant: z.enum(["editorial", "split", "centered"]),
    eyebrow: z.string().min(1).max(80).optional(),
    heading: z.string().min(1).max(160),
    body: z.string().min(1).max(500).optional(),
    primaryCta: ctaSchema.optional(),
    secondaryCta: ctaSchema.optional(),
    assetId: z.string().min(1).max(120).optional(),
    theme: z.enum(["light", "dark"]).optional(),
  })
  .strict();

const headingSchema = z
  .object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string().min(1).max(160) })
  .strict();

const textSchema = z.object({ text: z.string().min(1).max(2000) }).strict();

const imageSchema = z
  .object({
    assetId: z.string().min(1).max(120),
    alt: z.string().min(1).max(200).optional(),
    caption: z.string().min(1).max(200).optional(),
  })
  .strict();

const buttonSchema = z
  .object({ label: z.string().min(1).max(60), href, variant: z.enum(["primary", "secondary", "ghost"]).optional() })
  .strict();

const featureGridSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    items: z
      .array(
        z
          .object({ title: z.string().min(1).max(80), body: z.string().min(1).max(300) })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();

const faqSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    items: z
      .array(
        z
          .object({ question: z.string().min(1).max(160), answer: z.string().min(1).max(600) })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

const ctaBandSchema = z
  .object({
    heading: z.string().min(1).max(160),
    body: z.string().min(1).max(300).optional(),
    cta: ctaSchema,
  })
  .strict();

export type SiteLeafType =
  | "hero"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "featureGrid"
  | "faq"
  | "ctaBand";

const baseNode = { id: nodeId, styles: siteStyleSchema.optional() };

const leafNodeSchema = z.union([
  z.object({ ...baseNode, type: z.literal("hero"), props: heroSchema }),
  z.object({ ...baseNode, type: z.literal("heading"), props: headingSchema }),
  z.object({ ...baseNode, type: z.literal("text"), props: textSchema }),
  z.object({ ...baseNode, type: z.literal("image"), props: imageSchema }),
  z.object({ ...baseNode, type: z.literal("button"), props: buttonSchema }),
  z.object({ ...baseNode, type: z.literal("featureGrid"), props: featureGridSchema }),
  z.object({ ...baseNode, type: z.literal("faq"), props: faqSchema }),
  z.object({ ...baseNode, type: z.literal("ctaBand"), props: ctaBandSchema }),
]);

const sectionNodeSchema = z.object({
  id: nodeId,
  type: z.literal("section"),
  props: z.object({}).strict().optional(),
  styles: siteStyleSchema.optional(),
  children: z.array(leafNodeSchema).min(1).max(20),
});
export type SiteSectionNode = z.infer<typeof sectionNodeSchema>;
export type SiteLeafNode = z.infer<typeof leafNodeSchema>;
export type SiteNode = SiteSectionNode | SiteLeafNode;

export const SITE_NODE_TYPES: readonly string[] = [
  "section",
  "hero",
  "heading",
  "text",
  "image",
  "button",
  "featureGrid",
  "faq",
  "ctaBand",
];

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slugs use lowercase letters, digits, and hyphens");

/** Shared with entrypoints so transport validation and the domain agree. */
export const siteSlugSchema = slugSchema;

export const siteDocumentSchema = z
  .object({
    schemaVersion: z.literal(SITE_DOCUMENT_SCHEMA_VERSION),
    engine: z.literal(SITE_DOCUMENT_ENGINE),
    engineVersion: z.literal(SITE_DOCUMENT_ENGINE_VERSION),
    root: z.array(sectionNodeSchema).min(1).max(40),
    metadata: z
      .object({
        title: z.string().min(1).max(120),
        slug: slugSchema,
        description: z.string().min(1).max(300),
      })
      .strict(),
  })
  .strict();
export type SiteDocument = z.infer<typeof siteDocumentSchema>;

export const siteDraftSchema = z
  .object({
    id: z.uuid(),
    slug: slugSchema,
    title: z.string().min(1).max(120),
    status: z.literal("draft"),
    version: z.literal(1),
    document: siteDocumentSchema,
    source: z.enum(["template", "ai"]),
    brief: z.string().min(1).max(1000).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    checksum: z.string().min(1).max(128),
  })
  .strict();
export type SiteDraft = z.infer<typeof siteDraftSchema>;

export function parseSiteDocument(value: unknown): SiteDocument {
  return siteDocumentSchema.parse(value);
}

export function isSiteDocument(value: unknown): value is SiteDocument {
  return siteDocumentSchema.safeParse(value).success;
}

/** Collect every catalog asset id referenced by a document. */
export function collectAssetIds(document: SiteDocument): string[] {
  const ids = new Set<string>();
  for (const section of document.root) {
    for (const node of section.children) {
      const props = node.props as { assetId?: unknown };
      if (typeof props.assetId === "string") ids.add(props.assetId);
    }
  }
  return [...ids];
}

/** Collect raw URLs appearing in copy fields. Model output must not invent
 * links; only validated CTA hrefs may carry URLs. */
export function collectRawUrls(document: SiteDocument): string[] {
  const found: string[] = [];
  const scan = (value: unknown) => {
    if (typeof value !== "string") return;
    for (const match of value.matchAll(/https?:\/\/[^\s"')]+/g)) found.push(match[0]);
  };
  const scanNode = (node: SiteLeafNode) => {
    for (const [key, value] of Object.entries(node.props)) {
      if (key === "href") continue;
      if (typeof value === "string") scan(value);
      else if (Array.isArray(value))
        for (const item of value)
          if (item && typeof item === "object")
            for (const [itemKey, itemValue] of Object.entries(item)) {
              if (itemKey === "href") continue;
              if (typeof itemValue === "string") scan(itemValue);
            }
    }
  };
  for (const section of document.root) for (const node of section.children) scanNode(node);
  return [...new Set(found)];
}
