import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");

export const contentCalendarValuesSchema = z
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

export const contentCalendarChangesSchema = contentCalendarValuesSchema
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one content change is required");

const recordId = z.string().min(1).max(100);
export const contentCalendarCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("create"),
      id: z.uuid(),
      values: contentCalendarValuesSchema
        .partial()
        .extend({
          title: contentCalendarValuesSchema.shape.title,
          status: contentCalendarValuesSchema.shape.status.default("idea"),
        })
        .strict()
        .transform((values) =>
          contentCalendarValuesSchema.parse({
            ...Object.fromEntries(
              Object.keys(contentCalendarValuesSchema.shape).map((key) => [key, null]),
            ),
            ...values,
          }),
        ),
    })
    .strict(),
  z.object({ operation: z.literal("delete"), id: recordId }).strict(),
  z
    .object({
      operation: z.literal("reorder"),
      updates: z
        .array(
          z
            .object({
              id: recordId,
              column_key: z.string().trim().min(1).max(120),
              sort_order: z.number().min(-1e12).max(1e12),
            })
            .strict(),
        )
        .min(1)
        .max(250)
        .refine(
          (updates) => new Set(updates.map((item) => item.id)).size === updates.length,
          "An item can appear only once in a reorder",
        ),
    })
    .strict(),
]);
export const contentCalendarCommandPreviewSchema = z
  .object({
    requestKey: z.uuid(),
    command: contentCalendarCommandSchema,
  })
  .strict();
export const contentCalendarCommandProposalSchema = contentCalendarCommandPreviewSchema.extend({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const contentCalendarSnapshotSchema = z
  .object({
    id: recordId,
    title: z.string().max(240),
    revision: z.string().min(1).max(60),
    status: z.string().min(1).max(120),
    sortOrder: z.number(),
  })
  .strict();
export const contentCalendarCommandApprovalSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.string().min(1).max(100),
    requestKey: z.uuid(),
    command: contentCalendarCommandSchema,
    items: z.array(contentCalendarSnapshotSchema).max(250),
    columns: z
      .array(
        z
          .object({
            key: z.string().min(1).max(120),
            label: z.string().max(120),
            revision: z.string().min(1).max(60),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type ContentCalendarCommand = z.infer<typeof contentCalendarCommandSchema>;
export type ContentCalendarSnapshot = z.infer<typeof contentCalendarSnapshotSchema>;

/** Shared validation for live reads and the fictional transport; never publishes anything. */
export function prepareContentCalendarCommand(
  tenantId: string,
  raw: unknown,
  rows: ContentCalendarSnapshot[],
  columns: Array<{ key: string; label: string; revision: string }>,
) {
  const input = contentCalendarCommandPreviewSchema.parse(raw);
  const command = input.command;
  const ids =
    command.operation === "reorder" ? command.updates.map((item) => item.id) : [command.id];
  const items = rows.filter((row) => ids.includes(row.id)).sort((a, b) => a.id.localeCompare(b.id));
  const orderedColumns = [...columns].sort((a, b) => a.key.localeCompare(b.key));
  if (command.operation === "create" && items.length)
    throw new Error("This content item already exists. Reload before creating another item.");
  if (command.operation !== "create" && items.length !== ids.length)
    throw new Error("Content calendar item not found");
  const valid = new Set(columns.map((column) => column.key));
  if (command.operation === "create" && !valid.has(command.values.status))
    throw new Error("Choose a current content status");
  if (command.operation === "reorder") {
    if (command.updates.some((update) => !valid.has(update.column_key)))
      throw new Error("Choose a current content status");
    if (
      command.updates.every((update) => {
        const current = items.find((row) => row.id === update.id)!;
        return current.status === update.column_key && current.sortOrder === update.sort_order;
      })
    )
      throw new Error("No content positions would change");
  }
  return contentCalendarCommandApprovalSchema.omit({ digest: true }).parse({
    version: 1,
    tenantId,
    ...input,
    items,
    columns: orderedColumns,
  });
}
