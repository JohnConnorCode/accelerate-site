import { z } from "zod";
export const invoiceDesignSchema = z
  .object({
    layout: z.enum(["classic", "editorial"]),
    heading: z.string().trim().min(1).max(80),
    introduction: z.string().trim().max(500),
    closing: z.string().trim().max(300),
  })
  .strict();

export const defaultInvoiceDesign: z.infer<typeof invoiceDesignSchema> = {
  layout: "classic",
  heading: "Invoice",
  introduction: "Thank you for your business. Your invoice details are below.",
  closing: "Questions about this invoice? We’re here to help.",
};
