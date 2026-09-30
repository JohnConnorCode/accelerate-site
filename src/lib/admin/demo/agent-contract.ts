import { z } from "zod";
import { workspaceBrandSchema } from "@/lib/revenue-os/branding-contract";
export const DEMO_AGENT_TOOL_NAMES = [
  "get_today_snapshot",
  "search_contacts",
  "search_pipeline",
  "search_conversations",
  "read_complete_gmail_thread",
  "get_pending_actions",
  "propose_task",
  "propose_task_update",
  "propose_conversation_reply",
  "propose_founder_note",
  "propose_next_action",
  "get_collection_cases",
  "preview_collection_policy",
  "propose_collection_policy",
  "preview_collection_reminder",
  "propose_collection_reminder",
] as const;
const id = z.uuid();
export const demoAgentSnapshotSchema = z
  .object({
    brand: workspaceBrandSchema.optional(),
    brandRevision: z.number().int().positive().optional(),
    cooldownHours: z.number().int().min(1).max(720).optional(),
    collections: z
      .array(
        z
          .object({
            id,
            contactId: id,
            name: z.string().max(200),
            ownerEmail: z.string().max(320).nullable().optional(),
            email: z.email(),
            currency: z.string().length(3),
            status: z.enum(["open", "settled"]),
            revision: z.number().int().positive(),
            disputed: z.boolean(),
            paused: z.boolean(),
            pauseUntil: z.string().nullable(),
            promiseDate: z.string().nullable(),
            nextAction: z.string().max(1000),
            invoices: z
              .array(
                z
                  .object({
                    creationActionId: id,
                    invoiceId: z.string().max(100),
                    remaining: z.number().int().nonnegative(),
                    status: z.string().max(40),
                    dueDate: z.string().max(40).nullable(),
                    observedAt: z.string().max(40),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .max(10)
      .optional(),
    contacts: z
      .array(
        z
          .object({ id, name: z.string().max(200), email: z.email(), company: z.string().max(200) })
          .strict(),
      )
      .max(50),
    opportunities: z
      .array(
        z
          .object({
            id,
            name: z.string().max(200),
            personId: id,
            stage: z.string().max(100),
            nextAction: z.string().max(1000),
            value: z.number().nonnegative(),
          })
          .strict(),
      )
      .max(50),
    tasks: z
      .array(
        z
          .object({
            id,
            title: z.string().max(500),
            description: z.string().max(10000).nullable(),
            status: z.enum(["pending", "completed"]),
            priority: z.enum(["high", "medium", "low"]),
            due_date: z.string().max(40).nullable(),
            snoozed_until: z.string().max(40).nullable(),
            completed_at: z.string().max(40).nullable(),
          })
          .strict(),
      )
      .max(50),
    conversations: z
      .array(
        z
          .object({
            id,
            personId: id,
            subject: z.string().max(300),
            unread: z.number().int().nonnegative(),
            messages: z
              .array(
                z
                  .object({
                    id: z.string().max(100),
                    direction: z.enum(["inbound", "outbound"]),
                    body: z.string().max(4000),
                    at: z.string().max(40),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type DemoAgentSnapshot = z.infer<typeof demoAgentSnapshotSchema>;
export const demoAgentRequestSchema = z
  .object({
    scenarioId: z.enum([
      "northline-roofing",
      "alder-ridge-law",
      "ledgerstone-advisory",
      "hearthline-realty",
      "common-table-network",
      "superdebate",
    ]),
    clientMessageId: z.uuid(),
    text: z.string().trim().min(1).max(4000),
    snapshot: demoAgentSnapshotSchema,
    history: z
      .array(
        z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }).strict(),
      )
      .max(8),
  })
  .strict();
export const demoAgentProposalSchema = z
  .object({
    id,
    tool: z.enum(DEMO_AGENT_TOOL_NAMES),
    action_type: z.enum([
      "create_task",
      "update_task",
      "send_gmail_reply",
      "create_founder_note",
      "update_next_action",
      "send_collection_reminder",
      "update_collection_policy",
    ]),
    title: z.string().max(500),
    description: z.string().max(1000),
    status: z.literal("pending"),
    payload: z.record(z.string(), z.unknown()),
    created_at: z.string(),
    expires_at: z.string(),
  })
  .strict();
export type DemoAgentProposal = z.infer<typeof demoAgentProposalSchema>;
