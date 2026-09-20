import { z } from "zod";
import { websiteCommandSchema } from "./website-commands";
import { websiteDocumentSchema, websitePageSchema } from "./website-document";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const shape = websiteDocumentSchema.shape;
/** Closed operations, never arbitrary object paths or executable content. Page
 * replacement includes sections, layout, text and metadata using the UI schema. */
export const siteEditorChangeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("create_page"),
      id,
      title: z.string().min(1).max(160),
      path: websitePageSchema.shape.path,
      starter: z.enum(["service", "landing", "article"]),
      cloneId: id.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("put_page"), page: websitePageSchema }).strict(),
  z.object({ kind: z.literal("remove_page"), id }).strict(),
  z.object({ kind: z.literal("put_asset"), asset: shape.assets.element }).strict(),
  z.object({ kind: z.literal("remove_asset"), id }).strict(),
  z.object({ kind: z.literal("put_collection"), collection: shape.collections.element }).strict(),
  z.object({ kind: z.literal("remove_collection"), id }).strict(),
  z
    .object({
      kind: z.literal("put_entry"),
      collectionId: id,
      entry: shape.collections.element.shape.entries.element,
    })
    .strict(),
  z.object({ kind: z.literal("remove_entry"), collectionId: id, id }).strict(),
  z
    .object({
      kind: z.literal("configure"),
      identity: shape.identity.optional(),
      theme: shape.theme.optional(),
      navigation: shape.navigation.optional(),
      header: shape.header.removeDefault().optional(),
      footer: shape.footer.optional(),
      dock: shape.dock.removeDefault().optional(),
    })
    .strict(),
]);
export const siteEditorCommandSchema = z.union([
  websiteCommandSchema,
  z
    .object({
      operation: z.literal("edit"),
      requestKey: z.uuid(),
      expectedVersion: z.number().int().nonnegative().max(2_147_483_646),
      changes: z.array(siteEditorChangeSchema).min(1).max(100),
    })
    .strict(),
]);
export const siteEditorPrepareSchema = z.object({ command: siteEditorCommandSchema }).strict();
export const siteEditorStageSchema = siteEditorPrepareSchema
  .extend({
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const siteEditorExecuteSchema = z
  .object({
    actionId: z.uuid(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    summary: z.string().min(1).max(500),
  })
  .strict();
export const siteEditorReadSchema = z
  .object({
    view: z.enum([
      "pages",
      "page",
      "assets",
      "collections",
      "collection",
      "entry",
      "configuration",
      "history",
      "receipts",
      "models",
      "export",
      "schema",
      "forms",
    ]),
    schema: z.enum(["command", "page", "document", "ai"]).default("command"),
    revisionId: z.uuid().optional(),
    state: z.enum(["draft", "published"]).default("draft"),
    id: id.optional(),
    collectionId: id.optional(),
    offset: z.number().int().min(0).max(8_000_000).default(0),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();
export const SITE_EDITOR_TOOL_NAMES = [
  "read_site_editor",
  "prepare_site_change",
  "stage_site_change",
  "execute_site_change",
  "suggest_site_page",
] as const;
export type SiteEditorCommand = z.infer<typeof siteEditorCommandSchema>;
