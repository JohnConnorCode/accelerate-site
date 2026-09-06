import { z } from "zod";
const moduleId = z.string().trim().min(1).max(80);
export const moduleChangeSchema = z.union([
  z.object({ moduleId, enabled: z.boolean() }).strict(),
  z
    .object({
      moduleId,
      settings: z.record(
        z.string().max(80),
        z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]),
      ),
    })
    .strict(),
]);
export const moduleReadSchema = z.object({ moduleId: moduleId.optional() }).strict();
export const modulePreviewSchema = z.object({ change: moduleChangeSchema }).strict();
export const moduleProposalSchema = z
  .object({ change: moduleChangeSchema, digest: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const MODULE_CONTROL_TOOLS = [
  {
    name: "get_module_configuration",
    description:
      "Read available modules and their current enablement, public settings, declared fields and revision. Filter by moduleId for focused context. No credentials or arbitrary tenant configuration are returned.",
    impact: "read",
    confirmationRequired: false,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.module-configuration",
  },
  {
    name: "preview_module_configuration",
    description:
      "Preview enabling/disabling an optional module or editing declared public settings. Returns exact current/proposed values and a digest. No settings change is applied. Core modules cannot be disabled.",
    impact: "read",
    confirmationRequired: false,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.module-configuration",
  },
  {
    name: "propose_module_configuration",
    description:
      "Queue an exact module configuration preview for human approval using its change and digest. Does not apply settings, activate a plugin or approve an action. Disabled-plugin management remains available through this core tool.",
    impact: "internal_write",
    confirmationRequired: true,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.module-configuration",
  },
] as const;
export const MODULE_CONTROL_TOOL_NAMES = MODULE_CONTROL_TOOLS.map((tool) => tool.name);
