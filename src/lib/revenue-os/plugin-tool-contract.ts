/** Trusted tool registrations shared by manifest generation and AI dispatch.
 * This module never imports or evaluates plugin JavaScript. */
import { z } from "zod";
import { pluginWorkflowContract } from "./plugin-workflow-contract";

export const PLUGIN_TOOL_OPERATIONS = ["prepare-workflow", "propose-workflow"] as const;
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
