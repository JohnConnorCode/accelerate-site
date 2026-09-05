import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import Ajv from "ajv";
import { z } from "zod";
import { MODULE_MAP } from "./modules";
import { EXTENSION_WORKFLOWS } from "./extension-workflows.generated";
import { requireEnabledPlugin, loadPluginSources } from "./plugin-host";
import { evaluateInIsolate, type PluginJsonValue } from "./plugin-isolate";
import { proposeAction } from "./actions";
import { reviewWorkflowTasks } from "./workflow-tasks";
import { reviewStripeInvoice } from "./stripe-invoicing";
const ajv = new Ajv({ strict: true, allErrors: false });
const validators = new Map(
  [...MODULE_MAP.values()]
    .filter((module) => module.workflow)
    .map((module) => [module.id, ajv.compile(module.workflow!.inputSchema)]),
);
const planSchema = z
  .object({
    title: z.string().min(1).max(160),
    summary: z.string().min(1).max(2000),
    action: z
      .object({
        type: z.enum(["create_stripe_invoice_draft", "create_task_batch"]),
        payload: z.record(z.string(), z.json()),
      })
      .strict(),
  })
  .strict();
export type WorkflowPreview = {
  pluginId: string;
  title: string;
  summary: string;
  actionType: string;
  payload: Record<string, unknown>;
  digest: string;
};
export async function prepareWorkflowPlugin(
  db: SupabaseClient,
  pluginId: string,
  rawInput: unknown,
): Promise<WorkflowPreview> {
  const { moduleDef } = await requireEnabledPlugin(db, pluginId);
  const compiled = Object.hasOwn(EXTENSION_WORKFLOWS, pluginId)
    ? EXTENSION_WORKFLOWS[pluginId]
    : null;
  if (!moduleDef.workflow || !compiled) throw new Error("Unknown workflow plugin");
  const json = JSON.stringify(z.json().parse(rawInput));
  if (Buffer.byteLength(json) > 32768) throw new Error("Workflow input exceeds 32 KiB");
  const input = JSON.parse(json) as Record<string, unknown>;
  const validate = validators.get(pluginId);
  if (!validate || !validate(input))
    throw new Error("Workflow inputs do not match the plugin contract");
  const { snapshots } = await loadPluginSources(db, pluginId, moduleDef.workflow.sources, input);
  const evaluated = await evaluateInIsolate(compiled.code, {
    pluginId,
    timeoutMs: 250,
    memoryLimitBytes: 8 * 1024 * 1024,
    bindings: {
      workflowInput: () => input as PluginJsonValue,
      readSource(name) {
        if (typeof name !== "string" || !Object.hasOwn(snapshots, name))
          throw new Error("Undeclared workflow source");
        return snapshots[name] as PluginJsonValue;
      },
    },
  });
  const plan = planSchema.parse(evaluated.value);
  if (!moduleDef.workflow.actions.includes(plan.action.type))
    throw new Error("Plugin proposed an undeclared action");
  for (const source of moduleDef.workflow.sources) {
    if (plan.action.payload[source.inputKey] !== input[source.inputKey])
      throw new Error("Plugin changed the selected business identity");
  }
  let payload: Record<string, unknown> = plan.action.payload;
  if (plan.action.type === "create_stripe_invoice_draft")
    payload = await reviewStripeInvoice(db, payload);
  else payload = await reviewWorkflowTasks(db, payload);
  payload = { ...payload, pluginOrigin: { id: pluginId, sha256: compiled.sha256 } };
  await requireEnabledPlugin(db, pluginId);
  const digest = createHash("sha256")
    .update(
      JSON.stringify({ title: plan.title, summary: plan.summary, type: plan.action.type, payload }),
    )
    .digest("hex");
  return {
    pluginId,
    title: plan.title,
    summary: plan.summary,
    actionType: plan.action.type,
    payload,
    digest,
  };
}
export async function proposeWorkflowPlugin(
  db: SupabaseClient,
  pluginId: string,
  input: unknown,
  previewDigest: string,
  requestId: string,
  actorEmail: string,
) {
  z.uuid().parse(requestId);
  const preview = await prepareWorkflowPlugin(db, pluginId, input);
  if (preview.digest !== previewDigest)
    throw new Error(
      "Business inputs or connection changed since preview. Prepare the workflow again.",
    );
  const dedupeKey = `workflow:${pluginId}:${requestId}`;
  const { data: prior, error } = await db
    .from("action_queue")
    .select("*")
    .eq("dedupe_key", dedupeKey)
    .eq("source_context", "plugin")
    .maybeSingle();
  if (error) throw new Error("Workflow request receipt could not be checked");
  if (prior) {
    if (prior.payload?.previewDigest !== preview.digest)
      throw new Error("This request identity already belongs to a different plan");
    return prior;
  }
  return proposeAction(db, {
    actionType: preview.actionType,
    title: preview.title,
    description: preview.summary,
    payload: { ...preview.payload, previewDigest: preview.digest },
    sourceContext: "plugin",
    dedupeKey,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 20 * 3600000).toISOString(),
  });
}
/** A queued action is not authority to run a disabled or replaced plugin. */
export async function assertPluginActionAllowed(
  db: SupabaseClient,
  actionType: string,
  payload: Record<string, unknown>,
) {
  const origin = payload.pluginOrigin as { id?: unknown; sha256?: unknown } | undefined;
  if (!origin || typeof origin.id !== "string")
    throw new Error("Workflow action has no plugin origin");
  const { moduleDef } = await requireEnabledPlugin(db, origin.id);
  if (
    ["send_stripe_invoice", "publish_invoice_page"].includes(actionType) &&
    origin.id === "stripe-invoicing"
  )
    return;
  const compiled = Object.hasOwn(EXTENSION_WORKFLOWS, origin.id)
    ? EXTENSION_WORKFLOWS[origin.id]
    : null;
  if (
    !compiled ||
    compiled.sha256 !== origin.sha256 ||
    !moduleDef.workflow?.actions.includes(actionType)
  )
    throw new Error("Plugin implementation or action grant changed; fresh review is required");
}
