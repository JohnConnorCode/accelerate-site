/** Browser-safe discovery version shared by live and fictional workspaces. */
export const AI_TOOL_REGISTRY_VERSION = "revenue-os-tools.v24";
export const AI_TOOL_PACKS = ["core", "pipeline", "outreach"] as const;
export type AiToolPackId = (typeof AI_TOOL_PACKS)[number];
export type AiToolConnectionRequirement = "none" | "host_verified";
