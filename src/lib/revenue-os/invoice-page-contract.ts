import { z } from "zod";
export const invoiceDesignSchema = z
  .object({
    layout: z.enum(["classic", "editorial"]),
    heading: z.string().trim().min(1).max(80),
    introduction: z.string().trim().max(500),
    closing: z.string().trim().max(300),
    accentColor: z
      .string()
      .length(7)
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    font: z.enum(["workspace", "sans", "serif"]).optional(),
    spacing: z.enum(["comfortable", "compact"]).optional(),
  })
  .strict();

export const defaultInvoiceDesign: z.infer<typeof invoiceDesignSchema> = {
  layout: "classic",
  heading: "Invoice",
  introduction: "Thank you for your business. Your invoice details are below.",
  closing: "Questions about this invoice? We’re here to help.",
};
