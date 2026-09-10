import { z } from "zod";
import { MAX_WEBSITE_BYTES, parseWebsiteDocument, websiteDocumentSchema } from "./website-document";

const envelope = {
  requestKey: z.uuid(),
  expectedVersion: z.number().int().nonnegative().max(2_147_483_646),
};
/** UI, imports and approved AI actions use exactly this command boundary. */
export const websiteCommandSchema = z.discriminatedUnion("operation", [
  z.object({ ...envelope, operation: z.literal("save"), document: websiteDocumentSchema }).strict(),
  z.object({ ...envelope, operation: z.literal("publish"), revisionId: z.uuid() }).strict(),
  z.object({ ...envelope, operation: z.literal("rollback"), revisionId: z.uuid() }).strict(),
  z.object({ ...envelope, operation: z.literal("unpublish") }).strict(),
]);
export type WebsiteCommand = z.infer<typeof websiteCommandSchema>;
export const websiteReceiptSchema = z
  .object({
    requestKey: z.uuid(),
    operation: z.enum(["save", "publish", "rollback", "unpublish"]),
    version: z.number().int().positive(),
    draftRevisionId: z.uuid(),
    publishedRevisionId: z.uuid().nullable(),
    previousPublishedRevisionId: z.uuid().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type WebsiteReceipt = z.infer<typeof websiteReceiptSchema>;

export function parseWebsiteCommand(input: unknown): WebsiteCommand {
  const serialized = JSON.stringify(input);
  if (!serialized || new TextEncoder().encode(serialized).length > MAX_WEBSITE_BYTES + 1000)
    throw new Error("Website command exceeds the size limit");
  const command = websiteCommandSchema.parse(input);
  if (command.operation === "save") command.document = parseWebsiteDocument(command.document);
  return command;
}
