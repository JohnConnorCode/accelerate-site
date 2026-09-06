/** Trusted host contracts. Plugin source is never imported to discover schemas. */
import { z } from "zod";
import { stripeInvoiceInputSchema } from "./stripe-contract";
import { workflowTaskBatchSchema } from "./workflow-task-contract";

const taskFields = workflowTaskBatchSchema.shape;
export const PLUGIN_WORKFLOW_CONTRACTS = {
  "task-batch-opportunity-v1": {
    action: "create_task_batch",
    schema: z
      .object({ opportunityId: taskFields.opportunityId.unwrap(), tasks: taskFields.tasks })
      .strict(),
  },
  "task-batch-meeting-v1": {
    action: "create_task_batch",
    schema: z
      .object({ meetingId: taskFields.meetingId.unwrap(), tasks: taskFields.tasks })
      .strict(),
  },
  "stripe-invoice-draft-v1": {
    action: "create_stripe_invoice_draft",
    schema: stripeInvoiceInputSchema,
  },
} as const;
export type PluginWorkflowContractId = keyof typeof PLUGIN_WORKFLOW_CONTRACTS;

export function pluginWorkflowContract(id: string) {
  if (!Object.hasOwn(PLUGIN_WORKFLOW_CONTRACTS, id))
    throw new Error(`Unknown host workflow contract: ${id}`);
  return PLUGIN_WORKFLOW_CONTRACTS[id as PluginWorkflowContractId];
}

/** The bounded discovery schema is a projection, not a substitute for Zod's
 * UUID/date/regex checks, normalization or cross-field refinements. Both runtime
 * preview and the eventual business service run the original validators. */
export function pluginWorkflowDeclaration(id: string) {
  const contract = pluginWorkflowContract(id);
  const schema = z.toJSONSchema(contract.schema, { io: "input", target: "draft-7" });
  function project(node: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (["$schema", "format", "pattern"].includes(key)) continue;
      if (key === "properties")
        result[key] = Object.fromEntries(
          Object.entries(value as Record<string, Record<string, unknown>>).map(([name, field]) => [
            name,
            project(field),
          ]),
        );
      else if (key === "items") result[key] = project(value as Record<string, unknown>);
      else result[key] = value;
    }
    // These formats have fixed widths even though Zod's JSON Schema exporter
    // represents them with a format/pattern instead of explicit string bounds.
    if (node.format === "uuid") result.minLength = result.maxLength = 36;
    if (node.format === "date") result.minLength = result.maxLength = 10;
    return result;
  }
  return { actions: [contract.action], inputSchema: project(schema) };
}

export function parsePluginWorkflowInput(id: string, input: unknown) {
  return pluginWorkflowContract(id).schema.parse(input) as Record<string, unknown>;
}
