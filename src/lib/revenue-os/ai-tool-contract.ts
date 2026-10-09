/** Browser-safe discovery version shared by live and fictional workspaces. */
export const AI_TOOL_REGISTRY_VERSION = "revenue-os-tools.v30";
export const AI_TOOL_PACKS = ["core", "pipeline", "outreach"] as const;
export type AiToolPackId = (typeof AI_TOOL_PACKS)[number];
export type AiToolConnectionRequirement = "none" | "host_verified";

/** Semantic bindings are reviewed alongside the owning command, not inferred from HTTP verbs. */
export interface AiAdminOperation {
  id: string;
  version: number;
  scope: "workspace" | "platform";
  entrypoints: readonly { path: string; method: string; variant?: string }[];
  sourceEntrypoints?: readonly {
    kind: "server_action" | "client_write";
    path: string;
    operation: string;
  }[];
  verification: readonly string[];
}
