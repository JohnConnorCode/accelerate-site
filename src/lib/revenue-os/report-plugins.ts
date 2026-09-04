import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { MODULE_MAP, isModuleEnabled } from "./modules";
import { EXTENSION_REPORTS } from "./extension-reports.generated";
import { queryCapabilityEntities } from "./capability-data-api";
import { getEntityType } from "./entity-registry";
import { evaluateInIsolate, type PluginJsonValue } from "./plugin-isolate";
import { startAgentRun, finishAgentRun } from "./agent-trace";

const reportSchema = z
  .object({
    summary: z.string().min(1).max(500),
    totalFindings: z.number().int().min(0).max(300),
    items: z
      .array(
        z
          .object({
            source: z.string().max(32),
            id: z.string().min(1).max(128),
            title: z.string().min(1).max(200),
            detail: z.string().max(1000),
            severity: z.enum(["attention", "info"]),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type PluginReport = z.infer<typeof reportSchema> & {
  receipt: {
    runId: string;
    pluginId: string;
    sha256: string;
    inspectedRows: number;
    truncated: boolean;
    generatedAt: string;
    elapsedMs: number;
  };
};

/** All entrypoints converge here. Authority comes from current tenant state and
 * compiled declarations; neither the model nor the plugin supplies grants. */
export async function runReportPlugin(
  db: SupabaseClient,
  pluginId: string,
  actorEmail: string,
): Promise<PluginReport> {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("A tenant-bound host is required");
  const moduleDef = MODULE_MAP.get(pluginId);
  const source = Object.hasOwn(EXTENSION_REPORTS, pluginId) ? EXTENSION_REPORTS[pluginId] : null;
  if (!moduleDef?.report || !source) throw new Error("Unknown report plugin");
  const checkEnabled = async () => {
    const { data, error } = await db
      .from("tenants")
      .select("config,status")
      .eq("id", tenantId)
      .maybeSingle();
    if (error || !data) throw new Error("Workspace configuration could not be read");
    if (data.status !== "active") throw new Error("Workspace is not active");
    if (!isModuleEnabled(pluginId, data.config))
      throw new Error("Plugin is disabled. Enable it in Plugins or Integrations.");
  };
  await checkEnabled();
  const run = await startAgentRun(db, {
    surface: "plugin_report",
    model: "deterministic-plugin-v1",
    provider: "quickjs",
    actorEmail,
    promptPreview: `${pluginId}:${source.sha256}`,
  });
  if (!run.id) throw new Error("Could not open a plugin run receipt");
  try {
    const grant = {
      tenantId,
      capabilityId: pluginId,
      entities: moduleDef.report.sources.map((s) => s.type),
      recipes: [],
      namespace: false,
    };
    const now = new Date().toISOString();
    let inspectedRows = 0;
    let truncated = false;
    const snapshots: Record<string, Record<string, unknown>[]> = Object.create(null);
    for (const declared of moduleDef.report.sources) {
      const type = await getEntityType(db, tenantId, declared.type);
      const readable = type?.metadata?.readable_columns;
      if (
        !type ||
        type.isDisabled ||
        type.idColumn !== "id" ||
        !Array.isArray(readable) ||
        declared.columns.some((c) => c !== "id" && !readable.includes(c))
      )
        throw new Error(
          `Missing readable source ${declared.type}. Run the documented report-source setup for this workspace.`,
        );
      const result = await queryCapabilityEntities(db, grant, { type: declared.type, limit: 100 });
      inspectedRows += result.rows.length;
      truncated ||= result.usage.truncated;
      snapshots[declared.name] = result.rows.map((row) =>
        Object.fromEntries(declared.columns.map((c) => [c, row[c] ?? null])),
      );
    }
    if (Buffer.byteLength(JSON.stringify(snapshots), "utf8") > 65536)
      throw new Error("Report source snapshot exceeds 64 KiB; narrow its declaration");
    const evaluated = await evaluateInIsolate(source.code, {
      pluginId,
      timeoutMs: 250,
      memoryLimitBytes: 8 * 1024 * 1024,
      bindings: {
        readSource(name) {
          if (typeof name !== "string" || !Object.hasOwn(snapshots, name))
            throw new Error("Undeclared report source");
          return snapshots[name] as PluginJsonValue;
        },
        reportContext: () => ({ now }),
      },
    });
    const report = reportSchema.parse(evaluated.value);
    if (report.totalFindings < report.items.length)
      throw new Error("Plugin returned inconsistent finding counts");
    const seen = new Set<string>();
    for (const item of report.items) {
      const key = `${item.source}:${item.id}`;
      if (!snapshots[item.source]?.some((row) => row.id === item.id) || seen.has(key))
        throw new Error("Plugin returned an invalid or repeated source reference");
      seen.add(key);
    }
    // A disable during data acquisition prevents publishing the result too.
    await checkEnabled();
    const receipt = {
      runId: run.id,
      pluginId,
      sha256: source.sha256,
      inspectedRows,
      truncated: truncated || report.totalFindings > report.items.length,
      generatedAt: now,
      elapsedMs: evaluated.receipt.elapsedMs,
    };
    await finishAgentRun(db, run, "completed", {
      resultPreview: JSON.stringify({ ...receipt, totalFindings: report.totalFindings }),
    });
    const { data, error } = await db
      .from("agent_runs")
      .select("status")
      .eq("id", run.id)
      .maybeSingle();
    if (error || data?.status !== "completed")
      throw new Error("Plugin completion receipt could not be persisted");
    return { ...report, receipt };
  } catch (error) {
    await finishAgentRun(db, run, "failed", {
      error: "Plugin report failed; no result published.",
    });
    throw error;
  }
}
