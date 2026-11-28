import { z } from "zod";
import { invoiceDraftSchema } from "./schema";

export const invoiceCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("save_draft"),
      id: z.uuid().nullable(),
      revision: z.number().int().positive().nullable(),
      draft: invoiceDraftSchema,
    })
    .strict(),
  z
    .object({ operation: z.literal("issue"), id: z.uuid(), revision: z.number().int().positive() })
    .strict(),
  z
    .object({ operation: z.literal("void"), id: z.uuid(), revision: z.number().int().positive() })
    .strict(),
  z
    .object({
      operation: z.literal("delete_draft"),
      id: z.uuid(),
      revision: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("record_external_payment"),
      id: z.uuid(),
      revision: z.number().int().positive(),
      note: z.string().trim().min(1, "Say how it was paid.").max(300),
    })
    .strict(),
  z.object({ operation: z.literal("refresh_payment"), id: z.uuid() }).strict(),
]);
export type InvoiceCommand = z.input<typeof invoiceCommandSchema>;
