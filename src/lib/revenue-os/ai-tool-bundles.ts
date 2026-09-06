/** Pure planning over canonical module ownership; never grants execution authority. */
export const MAX_ACTIVE_AI_TOOLS = 40;
export const ALWAYS_LOADED_AI_TOOLS = [
  "discover_tool_bundles",
  "activate_tool_bundle",
  "get_today_snapshot",
  "search_contacts",
  "search_pipeline",
  "get_pending_actions",
  "get_workspace_capabilities",
  "propose_task",
] as const;
export const TOOL_DISCOVERY_METADATA = [
  {
    name: "discover_tool_bundles",
    description:
      "Find registered admin tool bundles by business intent, from any page. Results are paginated; activate a bundle to load its schemas.",
    impact: "read",
    confirmationRequired: false,
    serviceTarget: "revenue-os.tool-discovery",
    connectionRequirement: "none",
  },
  {
    name: "activate_tool_bundle",
    description:
      "Load one discovered bundle for subsequent turns of this command run. Replaces the previous bundle; grants no approval or additional permission.",
    impact: "read",
    confirmationRequired: false,
    serviceTarget: "revenue-os.tool-discovery",
    connectionRequirement: "none",
  },
] as const;
export interface ToolBundle {
  bundleId: string;
  moduleId: string;
  name: string;
  description: string;
  toolNames: string[];
}
export function buildToolBundles(
  modules: readonly {
    id: string;
    name: string;
    description: string;
    aiToolNames?: readonly string[];
  }[],
  tools: readonly { name: string }[],
): ToolBundle[] {
  const registered = new Set(tools.map((t) => t.name));
  if (registered.size !== tools.length) throw new Error("Duplicate registered tool");
  const owners = new Set<string>();
  const bundleIds = new Set<string>();
  const bundles: ToolBundle[] = [];
  const capacity = MAX_ACTIVE_AI_TOOLS - ALWAYS_LOADED_AI_TOOLS.length;
  for (const moduleDef of modules) {
    const names = [...(moduleDef.aiToolNames ?? [])].sort();
    for (const name of names) {
      if (!registered.has(name) || owners.has(name))
        throw new Error(`Invalid tool ownership: ${name}`);
      owners.add(name);
    }
    for (let offset = 0; offset < names.length; offset += capacity) {
      const bundleId = `${moduleDef.id}:${1 + offset / capacity}`;
      if (bundleIds.has(bundleId)) throw new Error(`Duplicate bundle: ${bundleId}`);
      bundleIds.add(bundleId);
      bundles.push({
        bundleId,
        moduleId: moduleDef.id,
        name: moduleDef.name,
        description: moduleDef.description,
        toolNames: names.slice(offset, offset + capacity),
      });
    }
  }
  for (const name of registered)
    if (!owners.has(name)) throw new Error(`Unreachable tool: ${name}`);
  return bundles;
}
export function rankToolBundles(bundles: ToolBundle[], query: string) {
  const words = [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])];
  return bundles
    .map((bundle) => {
      const text =
        `${bundle.moduleId} ${bundle.name} ${bundle.description} ${bundle.toolNames.join(" ")}`
          .toLowerCase()
          .replaceAll("_", " ");
      const tokens = new Set(text.match(/[a-z0-9]+/g) ?? []);
      const exactModule = query.trim().toLowerCase() === bundle.moduleId.toLowerCase();
      const score =
        (exactModule ? 100 : 0) +
        words.reduce(
          (sum, word) =>
            sum +
            (tokens.has(word) ||
            (word.length >= 4 &&
              [...tokens].some(
                (token) => token.length >= 4 && (token.startsWith(word) || word.startsWith(token)),
              ))
              ? 1
              : 0),
          0,
        );
      return { ...bundle, score };
    })
    .filter((bundle) => !words.length || bundle.score > 0)
    .sort((a, b) => b.score - a.score || a.bundleId.localeCompare(b.bundleId));
}
