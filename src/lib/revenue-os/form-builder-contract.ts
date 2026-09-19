import { z } from "zod";

/**
 * Pure central-AI authoring contract for the form builder. This file owns
 * the prepare/propose input shapes and tool descriptors; the service in
 * form-builder.ts owns validation and writes. ai-tools.ts imports schemas
 * from here so the registry never pulls the service graph into a cycle.
 */
export const formDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const formReviewInputSchema = z
  .object({
    action: z.literal("review"),
    id: z.uuid(),
    decision: z.enum(["accepted", "rejected"]),
    requestId: z.uuid(),
  })
  .strict();

const formDraftInputSchema = z
  .object({
    formId: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    schema: z.unknown(),
  })
  .strict();

export const prepareFormDraftInputSchema = formDraftInputSchema;
export const proposeFormDraftInputSchema = formDraftInputSchema
  .extend({ digest: formDigestSchema })
  .strict();
export const proposeFormPublishInputSchema = z
  .object({ formId: z.uuid(), digest: formDigestSchema })
  .strict();

export const FORM_BUILDER_AGENT_TOOLS = {
  prepare: {
    name: "prepare_form_draft",
    description:
      "Validate AI-authored form content and return the exact normalized draft with a review digest. Writes nothing; proposing the digest creates or updates a draft after human approval.",
    impact: "read",
    connectionRequirement: "none",
    confirmationRequired: false,
    serviceTarget: "revenue-os.form-builder",
  },
  proposeDraft: {
    name: "propose_form_draft",
    description:
      "Stage the exact previewed form draft for human approval using its digest. Creates a new draft or updates the named draft; never publishes. Returns a pending action receipt.",
    impact: "internal_write",
    connectionRequirement: "none",
    confirmationRequired: true,
    serviceTarget: "revenue-os.form-builder",
  },
  proposePublish: {
    name: "propose_form_publish",
    description:
      "Stage publication of the exact reviewed draft using its digest. Approval creates the public share link; unpublish retires it. Returns a pending action receipt.",
    impact: "internal_write",
    connectionRequirement: "none",
    confirmationRequired: true,
    serviceTarget: "revenue-os.form-builder",
  },
} as const;
export const FORM_BUILDER_AGENT_TOOL_NAMES = Object.values(FORM_BUILDER_AGENT_TOOLS).map(
  (tool) => tool.name,
);
