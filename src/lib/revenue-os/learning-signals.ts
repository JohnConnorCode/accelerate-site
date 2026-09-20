import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { proposeLearning } from "./learning-inbox";
import { requireEnabledPlugin } from "./plugin-host";
import { createWorkItem } from "./work-items";
import { registerWorkKindHandler } from "./work-executor";
import { createRevenueTask } from "./tasks";

export const correctionSignalSchema = z
  .object({
    kind: z.enum(["explicit_correction", "draft_edit"]),
    rule: z.string().trim().min(1).max(10000),
    details: z.string().max(10000).default(""),
    sourceKind: z
      .enum(["manual", "conversation", "action", "agent_run", "work_item"])
      .default("manual"),
    sourceId: z.string().uuid().optional(),
    pluginId: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional(),
    affectedWorkers: z
      .array(z.string().regex(/^[a-z0-9_-]{1,100}$/))
      .max(50)
      .default([]),
  })
  .strict();
export async function recordCorrectionSignal(db: SupabaseClient, raw: unknown, actor: string) {
  const input = correctionSignalSchema.parse(raw);
  if (input.sourceKind !== "manual") {
    if (!input.sourceId) throw new Error("Correction requires its source record");
    const table = {
      conversation: "conversations",
      action: "action_queue",
      agent_run: "agent_runs",
      work_item: "work_items",
    }[input.sourceKind];
    const { data, error } = await db
      .from(table)
      .select("id")
      .eq("id", input.sourceId)
      .maybeSingle();
    if (error || !data) throw new Error("Correction source is unavailable in this workspace");
  }
  if (input.pluginId) {
    const { moduleDef } = await requireEnabledPlugin(db, input.pluginId);
    if (!moduleDef.knowledge?.signalTypes.includes(input.kind))
      throw new Error("Plugin does not declare this learning signal");
  }
  const key = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const { error } = await db
    .from("learning_signals")
    .upsert(
      {
        kind: input.kind,
        source_kind: input.sourceKind,
        source_id: input.sourceId ?? actor,
        details: input.details,
        rule: input.rule,
        plugin_id: input.pluginId ?? null,
        receipt_key: `correction:${key}`,
      },
      { onConflict: "tenant_id,receipt_key", ignoreDuplicates: true },
    );
  if (error) throw new Error("Correction signal could not be saved");
  const proposal = await proposeLearning(db, {
    type: "messaging",
    rule: input.rule,
    rationale: input.details,
    confidence: input.kind === "draft_edit" ? "low" : "high",
    affectedWorkers: input.affectedWorkers,
    scope: input.pluginId ? { pluginId: input.pluginId } : null,
    sourceRefs: {
      signalKey: key,
      kind: input.kind,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId ?? null,
    },
    actorEmail: actor,
  });
  const { error: linkError } = await db
    .from("learning_signals")
    .update({
      proposal_id: proposal.id,
      category: "guidance",
      remedy: "Review the proposed correction before it affects future work",
      processed_at: new Date().toISOString(),
    })
    .eq("receipt_key", `correction:${key}`);
  if (linkError) throw new Error("Correction proposed but its signal link needs a retry");
  return proposal;
}
export async function listLearningSignals(db: SupabaseClient) {
  const { data, error } = await db
    .from("learning_signals")
    .select(
      "id,kind,source_kind,source_id,details,category,remedy,proposal_id,processed_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Learning signals could not be loaded");
  return data ?? [];
}
export async function scheduleLearningSignals(db: SupabaseClient) {
  const { error } = await db.rpc("collect_learning_signals");
  if (error) throw new Error("Learning signal collection failed");
  const { data, error: readError } = await db
    .from("learning_signals")
    .select("id")
    .is("processed_at", null)
    .order("created_at")
    .limit(50);
  if (readError) throw new Error("Pending learning signals could not be read");
  if (data?.length)
    await createWorkItem(db, {
      kind: "review_learning_signals",
      objective: "Review new learning evidence",
      reason: "New corrections and operational receipts need classification",
      source: "learning-signals",
      dedupeKey: "learning-signals:pending",
    });
}
export function registerLearningSignalHandlers() {
  registerWorkKindHandler("review_learning_signals", async (db, _item, signal) => {
    const { data, error } = await db
      .from("learning_signals")
      .select("*")
      .is("processed_at", null)
      .order("created_at")
      .limit(50);
    if (error) throw new Error("Learning signals could not be read");
    for (const row of data ?? []) {
      signal?.throwIfAborted();
      const category =
        row.kind === "tool_failure"
          ? "execution_defect"
          : row.kind === "missing_source"
            ? "knowledge_gap"
            : row.kind === "verified_outcome"
              ? "outcome"
              : "workflow_review";
      const remedy =
        category === "execution_defect"
          ? "Inspect the linked failed run and repair the failing service before retrying."
          : category === "knowledge_gap"
            ? "Add or reconnect the missing source, index it, then repeat the same query."
            : category === "outcome"
              ? "A successful action receipt is recorded. Improvement requires a comparable outcome and review."
              : "Review the rejection and decide whether the issue is data, timing, workflow or guidance.";
      if (category === "execution_defect")
        await createRevenueTask(db, {
          title: "Review an execution failure",
          description: `${row.details}\n${remedy}`,
          relatedType: row.source_kind,
          relatedId: row.source_id,
          source: "learning-signals",
          dedupeKey: `learning-signal:${row.id}`,
          actorEmail: "system",
        });
      const { error: writeError } = await db
        .from("learning_signals")
        .update({ category, remedy, processed_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("processed_at", null);
      if (writeError) throw new Error("Learning review status could not be saved");
    }
    return {
      status: "completed",
      outcome: `Classified ${data?.length ?? 0} new learning signals. No authority was changed.`,
    };
  });
}
