import { z } from "zod";
export const workflowTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000),
    dueDate: z.iso.date(),
    assigneeUserId: z.uuid(),
  })
  .strict();
export const workflowTaskBatchSchema = z
  .object({
    opportunityId: z.uuid().optional(),
    meetingId: z.uuid().optional(),
    tasks: z.array(workflowTaskSchema).min(1).max(10),
  })
  .strict()
  .refine((input) => Boolean(input.opportunityId) !== Boolean(input.meetingId), {
    message: "Choose exactly one source record",
  });
