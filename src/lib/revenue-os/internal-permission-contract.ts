import { z } from "zod";

export const INTERNAL_ACTION_FIELDS = {
  create_task: ["title", "description", "dueDate", "priority"],
  update_task: ["changeType", "title", "description", "dueDate", "priority", "until"],
  update_next_action: ["nextAction", "nextActionAt"],
  create_founder_note: ["body"],
  bulk_tag_contacts: ["add", "remove"],
  transition_opportunity: ["stage", "reason"],
} as const;
export const internalPermissionSchema = z
  .object({
    actionKey: z.enum(
      Object.keys(INTERNAL_ACTION_FIELDS) as [
        keyof typeof INTERNAL_ACTION_FIELDS,
        ...Array<keyof typeof INTERNAL_ACTION_FIELDS>,
      ],
    ),
    recordIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length),
    allowedFields: z.array(z.string()).min(1).max(10),
    expiresAt: z.iso.datetime({ offset: true }),
    maxDailyActions: z.number().int().min(1).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    for (const field of input.allowedFields)
      if (!(INTERNAL_ACTION_FIELDS[input.actionKey] as readonly string[]).includes(field))
        context.addIssue({ code: "custom", message: `Unsupported field: ${field}` });
    if (new Set(input.allowedFields).size !== input.allowedFields.length)
      context.addIssue({ code: "custom", message: "Duplicate allowed fields" });
  });
export const internalPermissionProposalSchema = z
  .object({
    permission: internalPermissionSchema,
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const agentWorkPlanSchema = z
  .object({
    objective: z.string().trim().min(1).max(1000),
    steps: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            instruction: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();
export const agentWorkStartSchema = z
  .object({
    plan: agentWorkPlanSchema,
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    requestId: z.uuid(),
  })
  .strict();
export const agentWorkReadSchema = z.object({ workItemId: z.uuid() }).strict();
export const agentWorkControlSchema = agentWorkReadSchema
  .extend({
    control: z.enum(["pause", "resume", "cancel"]),
    revision: z.number().int().min(1),
  })
  .strict();
