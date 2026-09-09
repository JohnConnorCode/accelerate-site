import { z } from "zod";
import { siteDocumentSchema } from "./document";
import { isSiteContentHref } from "./links";

/** A portable website contains content, never tenant IDs, credentials, code,
 * publication pointers, or authority. Import creates an unpublished revision. */
export const WEBSITE_SCHEMA_VERSION = 1 as const;
export const MAX_WEBSITE_BYTES = 8_000_000;
const identity = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const copy = z.string().max(20_000);
export const websiteHrefSchema = z
  .string()
  .max(1000)
  .refine(isSiteContentHref, "Use a site path, anchor, or HTTPS link without credentials");
export const websitePathSchema = z
  .string()
  .max(240)
  .regex(
    /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/,
    "Use a lowercase site path without a query or trailing slash",
  )
  .refine(
    (path) => !/^\/(?:api|admin|t|auth|login|logout|setup|demo)(?:\/|$)/.test(path),
    "This path belongs to the application",
  );
const link = z.object({ label: z.string().min(1).max(120), href: websiteHrefSchema }).strict();
const inline = z
  .object({
    text: copy,
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    code: z.boolean().optional(),
    href: websiteHrefSchema.optional(),
  })
  .strict();
const spans = z.array(inline).min(1).max(100);
export const websiteRichTextSchema = z
  .array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("paragraph"), content: spans }).strict(),
      z
        .object({
          type: z.literal("heading"),
          level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
          content: spans,
        })
        .strict(),
      z
        .object({
          type: z.literal("list"),
          ordered: z.boolean(),
          items: z.array(spans).min(1).max(100),
        })
        .strict(),
      z.object({ type: z.literal("quote"), content: spans }).strict(),
      z
        .object({
          type: z.literal("code"),
          text: copy,
          language: z
            .string()
            .max(40)
            .regex(/^[\w-]*$/),
        })
        .strict(),
      z
        .object({
          type: z.literal("image"),
          assetId: identity,
          alt: z.string().min(1).max(300),
          caption: z.string().max(500).optional(),
        })
        .strict(),
      z.object({ type: z.literal("divider") }).strict(),
    ]),
  )
  .max(1000);
export type WebsiteRichText = z.infer<typeof websiteRichTextSchema>;

const asset = z
  .object({
    id: identity,
    src: websiteHrefSchema,
    alt: z.string().max(300),
    width: z.number().int().positive().max(20000).optional(),
    height: z.number().int().positive().max(20000).optional(),
  })
  .strict();
const metadata = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(500),
    imageAssetId: identity.optional(),
    noIndex: z.boolean().default(false),
  })
  .strict();
/** Native templates are shipped React components with explicitly named content
 * slots. The template registry further validates these fields before saving. */
const fieldValue = z.union([copy, z.number().finite(), z.boolean(), z.array(copy).max(200)]);
const nativeSection = z
  .object({
    id: identity,
    template: identity,
    fields: z.record(identity, fieldValue),
    hidden: z.boolean().default(false),
  })
  .strict();
const page = z
  .object({
    id: identity,
    path: websitePathSchema,
    metadata,
    navigationLabel: z.string().max(100).optional(),
    content: z.discriminatedUnion("kind", [
      z
        .object({ kind: z.literal("native"), sections: z.array(nativeSection).min(1).max(100) })
        .strict(),
      z.object({ kind: z.literal("document"), document: siteDocumentSchema }).strict(),
      z.object({ kind: z.literal("article"), body: websiteRichTextSchema }).strict(),
    ]),
  })
  .strict();
const entry = z
  .object({
    id: identity,
    path: websitePathSchema,
    metadata,
    title: z.string().min(1).max(200),
    summary: z.string().max(1000),
    body: websiteRichTextSchema,
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(100)).max(30),
    date: z.iso.date().optional(),
    author: z.string().max(160).optional(),
    imageAssetId: identity.optional(),
  })
  .strict();
export const websiteDocumentSchema = z
  .object({
    schemaVersion: z.literal(WEBSITE_SCHEMA_VERSION),
    identity: z
      .object({
        name: z.string().min(1).max(160),
        tagline: z.string().max(500),
        logoAssetId: identity.optional(),
      })
      .strict(),
    navigation: z.array(link).max(30),
    footer: z.object({ text: z.string().max(2000), links: z.array(link).max(60) }).strict(),
    theme: z
      .object({
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        font: z.enum(["installation", "sans", "serif", "mono"]),
        radius: z.enum(["square", "soft", "round"]),
      })
      .strict(),
    assets: z.array(asset).max(3000),
    pages: z.array(page).min(1).max(500),
    collections: z
      .array(
        z
          .object({
            id: identity,
            title: z.string().min(1).max(160),
            entries: z.array(entry).max(1000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((document, ctx) => {
    const unique = (values: string[], label: string) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${label}` });
    };
    const entries = document.collections.flatMap((collection) => collection.entries);
    unique(
      [...document.pages, ...entries].map((item) => item.path),
      "public path",
    );
    unique(
      document.pages.map((item) => item.id),
      "page identity",
    );
    unique(
      document.assets.map((item) => item.id),
      "asset identity",
    );
    unique(
      document.collections.map((item) => item.id),
      "collection identity",
    );
    for (const collection of document.collections)
      unique(
        collection.entries.map((item) => item.id),
        `entry identity in ${collection.id}`,
      );
    const assets = new Set(document.assets.map((item) => item.id));
    const checkAsset = (id: string | undefined) => {
      if (id && !assets.has(id))
        ctx.addIssue({ code: "custom", message: `Unknown website asset: ${id}` });
    };
    const checkBody = (body: WebsiteRichText) =>
      body.forEach((block) => {
        if (block.type === "image") checkAsset(block.assetId);
      });
    checkAsset(document.identity.logoAssetId);
    for (const page of document.pages) {
      checkAsset(page.metadata.imageAssetId);
      if (page.content.kind === "article") checkBody(page.content.body);
      if (page.content.kind === "native")
        unique(
          page.content.sections.map((section) => section.id),
          `section identity in ${page.id}`,
        );
    }
    for (const entry of entries) {
      checkAsset(entry.imageAssetId);
      checkAsset(entry.metadata.imageAssetId);
      checkBody(entry.body);
    }
  });
export type WebsiteDocument = z.infer<typeof websiteDocumentSchema>;
export type WebsitePage = WebsiteDocument["pages"][number];

export function parseWebsiteDocument(value: unknown): WebsiteDocument {
  // Bound the untrusted envelope before walking recursive content. Transport
  // adapters also enforce request size before parsing JSON.
  const serialized = JSON.stringify(value);
  if (!serialized || new TextEncoder().encode(serialized).length > MAX_WEBSITE_BYTES)
    throw new Error("Website snapshot exceeds the 8 MB limit");
  return websiteDocumentSchema.parse(value);
}
