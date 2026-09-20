import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireEnabledPlugin, loadPluginSources } from "./plugin-host";
import { loadContextPack } from "./shared-context";
import type { KnowledgeChunk } from "./knowledge";

/** Knowledge declarations select a subset of existing host-reviewed grants.
 * Neither a manifest nor a retrieval request can introduce database authority. */
export async function retrievePluginKnowledge(
  db: SupabaseClient,
  pluginId: string,
  input: Record<string, unknown> = {},
) {
  if (
    Object.keys(input).length > 16 ||
    Object.values(input).some((v) => typeof v !== "string" || v.length > 200)
  )
    throw new Error("Plugin context accepts at most 16 bounded source selectors");
  const { moduleDef } = await requireEnabledPlugin(db, pluginId);
  const declaration = moduleDef.knowledge;
  if (!declaration) throw new Error("This plugin has no shared knowledge declaration");
  const sources = (moduleDef.report?.sources ?? moduleDef.workflow?.sources ?? []).filter(
    (source) => declaration.sourceNames.includes(source.name),
  );
  if (sources.length !== declaration.sourceNames.length)
    throw new Error("Plugin knowledge references an undeclared source");
  const { snapshots, truncated } = await loadPluginSources(db, pluginId, sources, input);
  const chunks: KnowledgeChunk[] = [];
  for (const [name, rows] of Object.entries(snapshots))
    for (const row of rows.slice(0, 10)) {
      const content = JSON.stringify(row);
      chunks.push({
        id: `${pluginId}:${name}:${row.id}`,
        source: "plugin",
        entityType: "plugin_record",
        entityId: String(row.id),
        title: `${moduleDef.name}: ${name}`,
        content: content.slice(0, 2000),
        occurredAt: new Date().toISOString(),
        confidence: 1,
        author: null,
        sourceLocation: `plugin:${pluginId}/${name}/${row.id}`,
        revision: createHash("sha256").update(content).digest("hex"),
        authority: "working",
      });
    }
  const current = await requireEnabledPlugin(db, pluginId);
  if (JSON.stringify(current.moduleDef.knowledge) !== JSON.stringify(declaration))
    throw new Error("Plugin context changed during retrieval");
  const context = await loadContextPack(db, {
    pluginId,
    enabledPluginIds: [pluginId],
    guidanceTypes: declaration.guidanceTypes,
    includeEvidence: false,
    maxChars: 4000,
  });
  return {
    guidance: context.guidance,
    chunks: chunks.slice(0, 20),
    missing: [
      ...context.missing,
      ...(truncated || chunks.length > 20
        ? ["Plugin source context was truncated; narrow the source selectors."]
        : []),
    ],
    contract: {
      pluginId,
      version: declaration.version,
      revision: createHash("sha256").update(JSON.stringify(declaration)).digest("hex"),
      prerequisites: declaration.prerequisites,
      success: declaration.success,
    },
  };
}
