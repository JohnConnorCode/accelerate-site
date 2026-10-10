import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  contentCalendarValuesSchema,
  contentCalendarChangesSchema,
  contentCalendarCommandPreviewSchema,
  contentCalendarCommandProposalSchema,
  contentCalendarCommandApprovalSchema,
  prepareContentCalendarCommand,
} from "./content-calendar-contract";
import {
  bindTenantDatabase,
  createPlatformServiceRoleClient,
  tenantIdForDatabase,
  createApprovedTenantWriter,
} from "@/lib/supabase/server";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { isModuleEnabled } from "./modules";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";

export type ContentCalendarReadInput = {
  status?: string;
  category?: string;
  limit?: number;
};

export { contentCalendarChangesSchema } from "./content-calendar-contract";

type ContentCalendarField = keyof z.infer<typeof contentCalendarValuesSchema>;

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

async function requireContentWorkspace(database: SupabaseClient) {
  const tenantId = tenantIdForDatabase(database);
  if (!tenantId) throw new Error("Content calendar requires a tenant-bound database");
  const { data: tenant, error } = await database
    .from("tenants")
    .select("status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || tenant?.status !== "active" || !contentModuleEnabled(tenant.config))
    throw new Error("The Content Operations module is unavailable for this workspace");
  return tenantId;
}

async function requireContentWriteAuthority(database: SupabaseClient, actorEmail: string) {
  await assertCurrentTenantAdmin(database, actorEmail);
  return requireContentWorkspace(database);
}

export async function previewContentCalendarCommand(database: SupabaseClient, raw: unknown) {
  const input = contentCalendarCommandPreviewSchema.parse(raw);
  const tenantId = await requireContentWorkspace(database);
  const ids =
    input.command.operation === "reorder"
      ? input.command.updates.map((item) => z.uuid().parse(item.id))
      : [z.uuid().parse(input.command.id)];
  const [records, columns] = await Promise.all([
    database.from("content_calendar").select("id,title,status,sort_order,updated_at").in("id", ids),
    database
      .from("kanban_columns")
      .select("column_key,label,updated_at")
      .eq("board_key", "content")
      .eq("tenant_id", tenantId)
      .limit(101),
  ]);
  if (records.error || columns.error)
    throw new Error("Content calendar is unavailable. Reload and retry.");
  const facts = prepareContentCalendarCommand(
    tenantId,
    input,
    (records.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      sortOrder: Number(row.sort_order),
      revision: row.updated_at,
    })),
    (columns.data ?? []).map((row) => ({
      key: row.column_key,
      label: row.label,
      revision: row.updated_at,
    })),
  );
  return { ...facts, digest: digest(facts) };
}

export async function proposeContentCalendarCommand(
  database: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  await requireContentWriteAuthority(database, actorEmail);
  const input = contentCalendarCommandProposalSchema.parse(raw);
  const preview = await previewContentCalendarCommand(database, {
    requestKey: input.requestKey,
    command: input.command,
  });
  if (input.digest !== preview.digest)
    throw new Error("Content calendar preview changed. Preview and approve again.");
  const { proposeAction } = await import("./actions");
  const operation = preview.command.operation;
  const target =
    operation === "create"
      ? preview.command.values.title
      : operation === "delete"
        ? preview.items[0]!.title
        : `${preview.items.length} content ${preview.items.length === 1 ? "item" : "items"}`;
  return proposeAction(database, {
    actionType: "content_calendar_change",
    title: `${operation === "create" ? "Create" : operation === "delete" ? "Delete" : "Reorder"} content: ${target.slice(0, 140)}`,
    description:
      operation === "delete"
        ? "Permanently deletes this calendar item. Website pages and approval history remain."
        : "Changes the editorial calendar only. No website content is published.",
    payload: preview,
    sourceContext: "admin_ai",
    entityType: "content_calendar",
    entityId: operation === "reorder" ? undefined : preview.command.id,
    dedupeKey: `content-calendar:${preview.tenantId}:${preview.requestKey}:${preview.digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

export async function executeContentCalendarCommand(
  database: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = contentCalendarCommandApprovalSchema.parse(raw);
  const tenantId = await requireContentWriteAuthority(database, actorEmail);
  const context = getTenantRequestContext();
  const { digest: expectedDigest, ...facts } = input;
  if (tenantId !== input.tenantId || digest(facts) !== expectedDigest || context?.kind !== "actor")
    throw new Error("Content calendar approval does not match its workspace or exact preview");
  const writer = createApprovedTenantWriter(tenantId, "content-calendar-command");
  const { data, error } = await writer.rpc("write_content_calendar_command", {
    p_tenant: tenantId,
    p_actor: context.user.id,
    p_actor_email: actorEmail,
    p_request_key: input.requestKey,
    p_digest: input.digest,
    p_input_digest: digest(input.command),
    p_command: input.command,
    p_items: input.items,
    p_columns: input.columns,
  });
  if (error) {
    if (error.code === "40001" || error.code === "23505")
      throw new Error("Content calendar changed. Reload, preview and approve again.");
    if (error.code === "42501")
      throw new Error("Workspace administrator or Content access is unavailable.");
    throw new Error(
      "Content calendar result could not be confirmed. Check the calendar before starting another change, or retry the same request.",
    );
  }
  if (!data || data.status !== "success")
    throw new Error("Content calendar returned no successful receipt");
  return data;
}

/** Direct human controls use the same exact command transaction as approved AI/MCP. */
export async function writeContentCalendarCommand(
  database: SupabaseClient,
  raw: unknown,
  actorEmail: string,
  expectedItems?: Array<{ id: string; revision: string }>,
) {
  await requireContentWriteAuthority(database, actorEmail);
  const input = contentCalendarCommandPreviewSchema.parse(raw);
  const { data: previous, error: receiptError } = await database
    .from("audit_log")
    .select("metadata")
    .eq("action", "content_calendar.command")
    .eq("entity_id", input.requestKey)
    .maybeSingle();
  if (receiptError) throw new Error("Content calendar receipts are unavailable. Reload and retry.");
  if (previous) {
    if (previous.metadata?.inputDigest !== digest(input.command))
      throw new Error(
        "This request key already saved different content. Reload before changing it.",
      );
    return { ...previous.metadata.result, replayed: true };
  }
  const preview = await previewContentCalendarCommand(database, raw);
  if (
    expectedItems &&
    (expectedItems.length !== preview.items.length ||
      preview.items.some(
        (item) =>
          !expectedItems.some(
            (expected) => expected.id === item.id && expected.revision === item.revision,
          ),
      ))
  )
    throw new Error("Content calendar changed in another session. Reload and retry.");
  return executeContentCalendarCommand(database, preview, actorEmail);
}

export async function previewContentCalendarUpdate(database: SupabaseClient, raw: unknown) {
  const input = contentCalendarPreviewSchema.parse(raw);
  const tenantId = await requireContentWorkspace(database);
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
