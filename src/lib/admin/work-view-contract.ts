import { z } from "zod";

// A saved Work view uses the same controls as the live task workspace.
export const workViewConfigSchema = z
  .object({
    owner: z.enum(["team", "me", "unassigned"]),
    status: z.enum(["pending", "snoozed", "completed", "all"]),
    source: z.string().max(100),
    search: z.string().max(100),
    layout: z.enum(["list", "board", "calendar"]),
    visibleFields: z
      .array(z.enum(["task", "related", "due", "priority"]))
      .min(1)
      .max(4)
      .refine((fields) => fields.includes("task"), "Task must remain visible"),
  })
  .strict();

export type WorkViewConfig = z.infer<typeof workViewConfigSchema>;
