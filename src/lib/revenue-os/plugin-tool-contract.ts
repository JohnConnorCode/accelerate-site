/** Trusted tool registrations shared by manifest generation and AI dispatch.
 * This module never imports or evaluates plugin JavaScript. */
import { z } from "zod";
import {
  billingReadInputSchema,
  billingPreviewInputSchema,
  billingProposalInputSchema,
} from "./billing-command-contract";
import { pluginWorkflowContract } from "./plugin-workflow-contract";
import { invoiceDesignSchema } from "./invoice-page-contract";

export const PLUGIN_TOOL_OPERATIONS = [
  "prepare-workflow",
  "propose-workflow",
  "propose-invoice-send",
  "preview-invoice-page",
  "propose-invoice-page",
  "get-billing-records",
  "preview-billing-change",
  "propose-billing-change",
] as const;
export type PluginToolOperation = (typeof PLUGIN_TOOL_OPERATIONS)[number];
type PluginToolModule = {
  id: string;
  name: string;
  description: string;
  workflow: { inputContract: string };
};
type ToolRegistration = {
  operation: PluginToolOperation;
  name: string;
  description: string;
  schema: z.ZodType;
  serviceTarget: string;
  connectionRequirement: "none";
  impact: "read" | "internal_write";
  confirmationRequired: boolean;
};
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export function pluginToolRegistrations(module: PluginToolModule): ToolRegistration[] {
  if (!/^[a-z][a-z0-9-]{2,48}$/.test(module.id)) throw new Error("Unsafe plugin tool id");
  const contract = pluginWorkflowContract(module.workflow.inputContract);
  const suffix = module.id.replaceAll("-", "_");
  const registrations: ToolRegistration[] = [
    {
      operation: "prepare-workflow",
      name: `prepare_${suffix}`,
      description: `Prepare ${module.name}: ${module.description}. Returns a reviewable plan, never executes it.`,
      schema: contract.schema,
      serviceTarget: "revenue-os.workflow-plugins",
      connectionRequirement: "none",
      impact: "read",
      confirmationRequired: false,
    },
    {
      operation: "propose-workflow",
      name: `propose_${suffix}`,
      description: `Stage the exact previewed ${module.name} for human approval. Use its digest and a stable UUID requestId. Never executes the action.`,
      schema: z
        .object({ input: contract.schema, digest: digestSchema, requestId: z.uuid() })
        .strict(),
      serviceTarget: "revenue-os.workflow-plugins",
      connectionRequirement: "none",
      impact: "internal_write",
      confirmationRequired: true,
    },
  ];
  // Native adapters remain reviewed host code. Naming a module cannot select
  // another service; only this explicit bundled registration adds them.
  if (module.id === "stripe-invoicing") {
    if (module.workflow.inputContract !== "stripe-invoice-draft-v1")
      throw new Error("Stripe adapter tools require the invoice workflow contract");
    registrations.push(
      {
        operation: "get-billing-records",
        name: "get_billing_records",
        description:
          "Read five current Stripe invoices or payments, source amounts, account mode and a next-page cursor. Includes account records outside this workspace. Never sum currencies or describe one page as an account total.",
        schema: billingReadInputSchema,
        serviceTarget: "revenue-os.billing-workspace",
        connectionRequirement: "none",
        impact: "read",
        confirmationRequired: false,
      },
      {
        operation: "preview-billing-change",
        name: "preview_billing_change",
        description:
          "Preview a billing customer, unpaid invoice cancellation or exact payment refund without provider effects. Refund amounts use Stripe minor units. Returns current customer, mode, consequences and review digest.",
        schema: billingPreviewInputSchema,
        serviceTarget: "revenue-os.billing-workspace",
        connectionRequirement: "none",
        impact: "read",
        confirmationRequired: false,
      },
      {
        operation: "propose-billing-change",
        name: "propose_billing_change",
        description:
          "Stage the exact billing command and preview digest for human approval. Cannot approve, refund or cancel by itself. Rechecks administrator authority and current billing facts. Reuse requestId for one logical request.",
        schema: billingProposalInputSchema,
        serviceTarget: "revenue-os.billing-workspace",
        connectionRequirement: "none",
        impact: "internal_write",
        confirmationRequired: true,
      },
      {
        operation: "propose-invoice-send",
        name: "propose_stripe_invoice_send",
        description:
          "Stage sending an existing completed Stripe invoice for explicit human approval. Does not send it.",
        schema: z.object({ creationActionId: z.uuid() }).strict(),
        serviceTarget: "revenue-os.stripe-invoicing",
        connectionRequirement: "none",
        impact: "internal_write",
        confirmationRequired: true,
      },
      {
        operation: "preview-invoice-page",
        name: "preview_invoice_page",
        description:
          "Preview a bounded customer invoice design using workspace branding and authoritative Stripe billing facts. Returns the publication digest; does not publish.",
        schema: z.object({ creationActionId: z.uuid(), design: invoiceDesignSchema }).strict(),
        serviceTarget: "revenue-os.invoice-pages",
        connectionRequirement: "none",
        impact: "read",
        confirmationRequired: false,
      },
      {
        operation: "propose-invoice-page",
        name: "propose_invoice_page",
        description:
          "Stage the exact previewed invoice page for human publication approval. Does not publish or email the customer.",
        schema: z
          .object({
            creationActionId: z.uuid(),
            design: invoiceDesignSchema,
            digest: digestSchema,
            requestId: z.uuid(),
          })
          .strict(),
        serviceTarget: "revenue-os.invoice-pages",
        connectionRequirement: "none",
        impact: "internal_write",
        confirmationRequired: true,
      },
    );
  }
  return registrations;
}
export type PluginToolDeclaration = Omit<ToolRegistration, "schema"> & {
  inputSchema: Record<string, unknown>;
};
export function pluginToolDeclaration(registration: ToolRegistration): PluginToolDeclaration {
  const { schema, ...metadata } = registration;
  return { ...metadata, inputSchema: z.toJSONSchema(schema, { io: "input", target: "draft-7" }) };
}
export function pluginToolDeclarations(module: PluginToolModule) {
  return pluginToolRegistrations(module).map(pluginToolDeclaration);
}
export function assertPluginToolGrants(
  module: PluginToolModule & {
    aiToolNames?: string[];
    workflow: { inputContract: string; tools: PluginToolDeclaration[] };
  },
) {
  const declarations = pluginToolDeclarations(module);
  if (
    JSON.stringify(module.workflow.tools) !== JSON.stringify(declarations) ||
    JSON.stringify(module.aiToolNames) !== JSON.stringify(declarations.map((tool) => tool.name))
  )
    throw new Error(`Plugin tool grants disagree with host registration: ${module.id}`);
}
