/** Pure policy and replay contract for the supported host workflow actions. */
import { createHash } from "node:crypto";
import { z } from "zod";
import { reversibilityOf } from "./action-reversibility-contract";

const registrationSchema = z
  .object({
    action: z.enum(["create_task_batch", "create_stripe_invoice_draft"]),
    trustCeiling: z.enum(["always-propose", "autonomous"]),
    evidence: z
      .object({
        kind: z.literal("canonical-record"),
        inputKey: z.enum(["opportunityId", "meetingId", "contactId"]),
        sourceType: z.enum(["workflow_opportunities", "workflow_meetings", "workflow_contacts"]),
      })
      .strict(),
    idempotency: z
      .object({
        request: z.literal("workflow-request-v1"),
        effect: z.enum(["task-content-sha256-v1", "stripe-action-v1"]),
      })
      .strict(),
  })
  .strict();
export type WorkflowPolicyRegistration = z.infer<typeof registrationSchema>;
export function compileWorkflowPolicy(raw: unknown) {
  const registration = registrationSchema.parse(raw);
  const expected =
    registration.action === "create_stripe_invoice_draft"
      ? { inputKey: "contactId", sourceType: "workflow_contacts", effect: "stripe-action-v1" }
      : registration.evidence.inputKey === "opportunityId"
        ? {
            inputKey: "opportunityId",
            sourceType: "workflow_opportunities",
            effect: "task-content-sha256-v1",
          }
        : {
            inputKey: "meetingId",
            sourceType: "workflow_meetings",
            effect: "task-content-sha256-v1",
          };
  if (
    registration.evidence.inputKey !== expected.inputKey ||
    registration.evidence.sourceType !== expected.sourceType ||
    registration.idempotency.effect !== expected.effect
  )
    throw new Error(
      "Workflow policy does not match the action's identity and replay implementation",
    );
  const classification = reversibilityOf(registration.action);
  const warnings: string[] = [];
  let trustCeiling = registration.trustCeiling;
  if (classification.reversibility === "irreversible" && trustCeiling !== "always-propose") {
    trustCeiling = "always-propose";
    warnings.push(`${registration.action}: irreversible actions require always-propose`);
  }
  return {
    policy: {
      version: 1 as const,
      ...registration,
      tier: classification.impact === "external_action" ? (3 as const) : (2 as const),
      impact: classification.impact,
      reversibility: classification.reversibility,
      trustCeiling,
    },
    warnings,
  };
}
export type WorkflowPolicy = ReturnType<typeof compileWorkflowPolicy>["policy"];
export function assertWorkflowEvidenceSource(
  policy: WorkflowPolicy,
  sources: { inputKey: string; type: string; columns: string[] }[],
) {
  if (
    !sources.some(
      (source) =>
        source.inputKey === policy.evidence.inputKey &&
        source.type === policy.evidence.sourceType &&
        source.columns.includes("id"),
    )
  )
    throw new Error("Workflow requires its declared canonical evidence source");
}
export function workflowRequestKey(policy: WorkflowPolicy, pluginId: string, requestId: string) {
  if (policy.idempotency.request !== "workflow-request-v1")
    throw new Error("Unsupported workflow request policy");
  z.uuid().parse(requestId);
  return `workflow:${pluginId}:${requestId}`;
}
export function workflowTaskEffectKey(
  pluginId: string,
  source: string | undefined,
  item: Record<string, unknown>,
) {
  return `plugin:${createHash("sha256")
    .update(JSON.stringify({ pluginId, source, ...item }))
    .digest("hex")}`;
}
export function stripeWorkflowEffectKey(tenantId: string, actionId: string) {
  return `accelerate:${tenantId}:${actionId}`;
}
