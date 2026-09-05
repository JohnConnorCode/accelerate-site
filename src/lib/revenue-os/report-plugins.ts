import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { EXTENSION_REPORTS } from "./extension-reports.generated";
import { requireEnabledPlugin, loadPluginSources } from "./plugin-host";
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
  const { moduleDef } = await requireEnabledPlugin(db, pluginId);
  const source = Object.hasOwn(EXTENSION_REPORTS, pluginId) ? EXTENSION_REPORTS[pluginId] : null;
  if (!moduleDef.report || !source) throw new Error("Unknown report plugin");
  const run = await startAgentRun(db, {
    surface: "plugin_report",
    model: "deterministic-plugin-v1",
    provider: "quickjs",
    actorEmail,
    promptPreview: `${pluginId}:${source.sha256}`,
  });
  if (!run.id) throw new Error("Could not open a plugin run receipt");
  try {
    const now = new Date().toISOString();
    const { snapshots, inspectedRows, truncated } = await loadPluginSources(
      db,
      pluginId,
      moduleDef.report.sources,
    );
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
    await requireEnabledPlugin(db, pluginId);
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
