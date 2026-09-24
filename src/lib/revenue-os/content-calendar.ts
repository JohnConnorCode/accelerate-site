import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  bindTenantDatabase,
  createPlatformServiceRoleClient,
  tenantIdForDatabase,
} from "@/lib/supabase/server";
import { isModuleEnabled } from "./modules";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";

export type ContentCalendarReadInput = {
  status?: string;
  category?: string;
  limit?: number;
};

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");

const contentCalendarValuesSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    slug: z.string().trim().max(240).nullable(),
    status: z.string().trim().min(1).max(120),
    category: z.string().trim().max(120).nullable(),
    target_keywords: z.array(z.string().trim().min(1).max(100)).max(30).nullable(),
    pillar: z.string().trim().max(160).nullable(),
    funnel_stage: z.enum(["awareness", "consideration", "decision"]).nullable(),
    target_publish_date: dateSchema.nullable(),
    actual_publish_date: dateSchema.nullable(),
    author: z.string().trim().max(160).nullable(),
    notes: z.string().max(1600).nullable(),
    seo_title: z.string().trim().max(160).nullable(),
    seo_description: z.string().trim().max(320).nullable(),
    word_count_target: z.number().int().min(1).max(100000).nullable(),
  })
  .strict();

type ContentCalendarField = keyof z.infer<typeof contentCalendarValuesSchema>;

export const contentCalendarChangesSchema = contentCalendarValuesSchema
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one content change is required");

export const contentCalendarPreviewSchema = z
  .object({
    id: z.uuid(),
    changes: contentCalendarChangesSchema.refine(
      (changes) => Object.keys(changes).length <= 5,
      "Update no more than five fields at once",
    ),
  })
  .strict();

export const contentCalendarProposalSchema = contentCalendarPreviewSchema.extend({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});

const contentCalendarApprovalSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    id: z.uuid(),
    before: z.record(z.string(), z.unknown()),
    after: z.record(z.string(), z.unknown()),
    revision: z.string().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const contentCalendarFields =
  "id,title,slug,status,category,target_keywords,pillar,funnel_stage,target_publish_date,actual_publish_date,author,notes,seo_title,seo_description,word_count_target,updated_at";
const contentCalendarMutableFields = contentCalendarFields
  .split(",")
  .filter((field) => field !== "id" && field !== "updated_at");
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function contentModuleEnabled(config: unknown) {
  const modules =
    config && typeof config === "object" && "modules" in config
      ? (config as { modules?: Record<string, boolean> }).modules
      : undefined;
  return isModuleEnabled("content", { modules });
}

async function readContentCalendarItem(database: SupabaseClient, id: string) {
  const { data, error } = await database
    .from("content_calendar")
    .select(contentCalendarFields)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read content calendar item: ${error.message}`);
  if (!data) throw new Error("Content calendar item not found");
  return data as Record<string, unknown>;
}

async function requireContentWriteAuthority(database: SupabaseClient, actorEmail: string) {
  const tenantId = await assertCurrentTenantAdmin(database, actorEmail);
  const { data: tenant, error } = await database
    .from("tenants")
    .select("status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || tenant?.status !== "active" || !contentModuleEnabled(tenant.config))
    throw new Error("The Content Operations module is unavailable for this workspace");
  return tenantId;
}

export async function previewContentCalendarUpdate(database: SupabaseClient, raw: unknown) {
  const input = contentCalendarPreviewSchema.parse(raw);
  const tenantId = tenantIdForDatabase(database);
  if (!tenantId) throw new Error("Content calendar requires a tenant-bound database");
  const before = await readContentCalendarItem(database, input.id);
  const { updated_at: revision, ...beforeValues } = before;
  const mutableBefore = Object.fromEntries(
    contentCalendarMutableFields.map((field) => [field, beforeValues[field] ?? null]),
  );
  const after = contentCalendarValuesSchema.parse({ ...mutableBefore, ...input.changes });
  const facts = {
    version: 1 as const,
    tenantId,
    id: input.id,
    before: beforeValues,
    after,
    revision,
  };
  const changedFields = (Object.keys(input.changes) as ContentCalendarField[]).filter(
    (field) => JSON.stringify(beforeValues[field]) !== JSON.stringify(after[field]),
  );
  if (!changedFields.length) throw new Error("No content calendar values would change");
  return {
    ...facts,
    digest: digest(facts),
    changes: changedFields.map((field) => ({
      field,
      before: beforeValues[field] ?? null,
      after: after[field] ?? null,
    })),
    requiresHumanApproval: true,
  };
}

export async function proposeContentCalendarUpdate(
  database: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = contentCalendarProposalSchema.parse(raw);
  await requireContentWriteAuthority(database, actorEmail);
  const preview = await previewContentCalendarUpdate(database, {
    id: input.id,
    changes: input.changes,
  });
  if (preview.digest !== input.digest)
    throw new Error("Content calendar preview changed. Preview again before proposing.");
  const payload = contentCalendarApprovalSchema.parse({
    version: preview.version,
    tenantId: preview.tenantId,
    id: preview.id,
    before: preview.before,
    after: preview.after,
    revision: preview.revision,
    digest: preview.digest,
  });
  const { proposeAction } = await import("./actions");
  return proposeAction(database, {
    actionType: "update_content_calendar_item",
    title: `Update content: ${String(preview.after.title ?? preview.before.title).slice(0, 140)}`,
    description: preview.changes
      .map(
        (change) =>
          `${change.field}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`,
      )
      .join("\n"),
    payload,
    sourceContext: "admin_ai",
    entityType: "content_calendar",
    entityId: preview.id,
    dedupeKey: `content-calendar-update:${preview.tenantId}:${preview.id}:${preview.digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

/** The human admin editor and approved AI actions share this tenant-scoped, CAS-protected writer. */
export async function updateContentCalendarItem(
  database: SupabaseClient,
  id: string,
  rawChanges: unknown,
  actorEmail: string,
  expectedRevision?: string,
) {
  const changes = contentCalendarChangesSchema.parse(rawChanges);
  const tenantId = await requireContentWriteAuthority(database, actorEmail);
  const current = await readContentCalendarItem(database, id);
  if (expectedRevision !== undefined && current.updated_at !== expectedRevision)
    throw new Error("Content calendar item changed after approval. Preview and approve again.");
  if (
    (Object.keys(changes) as ContentCalendarField[]).every(
      (field) => JSON.stringify(current[field] ?? null) === JSON.stringify(changes[field] ?? null),
    )
  )
    return current;
  const writer = bindTenantDatabase(
    createPlatformServiceRoleClient("approved-content-calendar-update"),
    tenantId,
    true,
  );
  const { data, error } = await writer
    .from("content_calendar")
    .update(changes)
    .eq("id", id)
    .eq("updated_at", current.updated_at)
    .select(contentCalendarFields)
    .maybeSingle();
  if (error) throw new Error(`Content calendar item could not be updated: ${error.message}`);
  if (!data) throw new Error("Content calendar item changed in another session. Reload and retry.");
  return data;
}

export async function executeContentCalendarUpdate(
  database: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = contentCalendarApprovalSchema.parse(raw);
  const tenantId = await requireContentWriteAuthority(database, actorEmail);
  const { digest: expectedDigest, ...facts } = input;
  if (tenantId !== input.tenantId || digest(facts) !== expectedDigest)
    throw new Error("Content calendar approval does not match its workspace or exact preview");
  const current = await readContentCalendarItem(database, input.id);
  const { updated_at: revision, ...beforeValues } = current;
  if (revision !== input.revision)
    throw new Error("Content calendar item changed after approval. Preview and approve again.");
  if (JSON.stringify(beforeValues) !== JSON.stringify(input.before))
    throw new Error("Content calendar item changed after approval. Preview and approve again.");
  const changes = Object.fromEntries(
    contentCalendarMutableFields
      .filter(
        (field) =>
          JSON.stringify(input.before[field] ?? null) !==
          JSON.stringify(input.after[field] ?? null),
      )
      .map((field) => [field, input.after[field]]),
  );
  return updateContentCalendarItem(database, input.id, changes, actorEmail, input.revision);
}

export async function listContentCalendarItems(
  database: SupabaseClient,
  input: ContentCalendarReadInput = {},
) {
  const { status, category, limit } = input;
  if (status !== undefined && (!status.trim() || status.length > 120))
    throw new Error("Status must be 1 to 120 characters");
  if (category !== undefined && (!category.trim() || category.length > 120))
    throw new Error("Category must be 1 to 120 characters");
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 50))
    throw new Error("Limit must be an integer from 1 to 50");

  let query = database
    .from("content_calendar")
    .select(
      "id,title,slug,status,sort_order,category,target_keywords,pillar,funnel_stage,target_publish_date,actual_publish_date,author,notes,seo_title,seo_description,word_count_target,created_at,updated_at",
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status.trim());
  if (category) query = query.eq("category", category.trim());
  if (limit !== undefined) query = query.limit(limit + 1);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read content calendar: ${error.message}`);
  const rows = data ?? [];
  return {
    items: limit === undefined ? rows : rows.slice(0, limit),
    count: limit === undefined ? rows.length : Math.min(rows.length, limit),
    truncated: limit !== undefined && rows.length > limit,
  };
}
