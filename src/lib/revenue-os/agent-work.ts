import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { createWorkItem, type WorkItem } from "./work-items";
import { registerWorkKindHandler } from "./work-executor";
import { deferWork, reconcileWork, type WorkResult } from "./work-result";
import { checkBudgets, claimResourceBudget } from "./budgets";
import { recordAudit } from "./audit";
import {
  agentWorkPlanSchema,
  agentWorkStartSchema,
  agentWorkReadSchema,
  agentWorkControlSchema,
} from "./internal-permission-contract";

const progressSchema = agentWorkPlanSchema.extend({
  requesterId: z.uuid(),
  requesterEmail: z.string().email(),
  conversationId: z.uuid().nullable(),
  control: z.enum(["running", "paused", "cancelled"]),
  steps: z
    .array(
      agentWorkPlanSchema.shape.steps.element.extend({
        status: z.enum(["pending", "running", "awaiting_approval", "completed", "needs_attention"]),
        runId: z.string().nullable(),
        actionIds: z.array(z.uuid()),
        receipt: z.string().max(12000),
      }),
    )
    .min(1)
    .max(8),
});
type Progress = z.infer<typeof progressSchema>;
function requestingActor(db: SupabaseClient, email: string) {
  const actor = getTenantRequestContext();
  if (
    actor?.kind !== "actor" ||
    actor.database !== db ||
    actor.user.email !== email ||
    actor.tenant.id !== tenantIdForDatabase(db)
  )
    throw new Error("Agent work requires a current authenticated requesting member");
  return actor;
}
export async function previewAgentWork(
  db: SupabaseClient,
  input: unknown,
  email: string,
  conversationId?: string | null,
) {
  const actor = requestingActor(db, email);
  const plan = agentWorkPlanSchema.parse(input);
  if (conversationId) {
    const conversation = await db
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("actor_email", email)
      .maybeSingle();
    if (conversation.error || !conversation.data)
      throw new Error("Conversation is not owned by the requesting member");
  }
  const digest = createHash("sha256")
    .update(JSON.stringify([actor.tenant.id, actor.user.id, conversationId ?? null, plan]))
    .digest("hex");
  return {
    plan,
    digest,
    requirements:
      "Runs ordered steps with the existing agent tools. Business writes use exact proposals or current bounded internal permission. External effects always wait for approval. Work survives browser closure while the work-engine scheduler is active.",
  };
}
export async function startAgentWork(
  db: SupabaseClient,
  input: unknown,
  email: string,
  conversationId?: string | null,
) {
  const parsed = agentWorkStartSchema.parse(input);
  const preview = await previewAgentWork(db, parsed.plan, email, conversationId);
  if (preview.digest !== parsed.digest) throw new Error("Work plan changed; preview it again");
  const actor = requestingActor(db, email);
  const budgets = await checkBudgets(db, { coworkerId: "*", budgetKinds: ["vendor_api_calls"] });
  if (!budgets.some((budget) => Number.isFinite(budget.limit) && budget.allowed))
    throw new Error(
      "Set a finite, available AI call budget in the workspace before starting durable agent work",
    );
  const progress: Progress = {
    ...preview.plan,
    requesterId: actor.user.id,
    requesterEmail: email,
    conversationId: conversationId ?? null,
    control: "running",
    steps: preview.plan.steps.map((step) => ({
      ...step,
      status: "pending",
      runId: null,
      actionIds: [],
      receipt: "",
    })),
  };
  const result = await createWorkItem(db, {
    kind: "agent_work",
    objective: preview.plan.objective,
    reason: "Requested conversational delegation",
    source: "agent_conversation",
    actorEmail: email,
    dedupeKey: `agent-work:${actor.user.id}:${parsed.requestId}`,
    dedupeAcrossStatuses: true,
    maxAttempts: 3,
    agentPlan: progress,
  });
  const prior = progressSchema.parse(result.workItem.agent_plan);
  if (
    JSON.stringify({
      objective: prior.objective,
      steps: prior.steps.map(({ title, instruction }) => ({ title, instruction })),
    }) !== JSON.stringify(parsed.plan)
  )
    throw new Error("Request key was already used for another plan");
  return {
    workItemId: result.workItem.id,
    revision: result.workItem.agent_plan_revision,
    status: result.workItem.status,
    plan: prior,
    deduplicated: result.deduplicated,
    authorization: { mode: "delegated_work", scope: "work_orchestration" },
    progressUrl: `/t/${encodeURIComponent(actor.tenant.slug)}/admin/work?tab=ai`,
  };
}
export async function getAgentWork(db: SupabaseClient, input: unknown, email: string) {
  const actor = requestingActor(db, email);
  const { workItemId } = agentWorkReadSchema.parse(input);
  const result = await db
    .from("work_items")
    .select("*")
    .eq("id", workItemId)
    .eq("kind", "agent_work")
    .maybeSingle();
  if (result.error || !result.data || result.data.agent_plan?.requesterId !== actor.user.id)
    throw new Error("Agent work not found for this member");
  return {
    workItemId,
    status: result.data.status,
    revision: result.data.agent_plan_revision,
    plan: progressSchema.parse(result.data.agent_plan),
    outcome: result.data.outcome,
    error: result.data.error,
    authorization: { mode: "delegated_work", scope: "work_orchestration" },
  };
}
export async function controlAgentWork(db: SupabaseClient, input: unknown, email: string) {
  const change = agentWorkControlSchema.parse(input);
  const current = await getAgentWork(db, { workItemId: change.workItemId }, email);
  if (current.revision !== change.revision)
    throw new Error("Work changed; read its current revision first");
  if (["completed", "cancelled", "failed"].includes(current.status))
    throw new Error("This work is already terminal");
  const control =
    change.control === "resume" ? "running" : change.control === "pause" ? "paused" : "cancelled";
  const result = await db
    .from("work_items")
    .update({
      agent_plan: { ...current.plan, control },
      agent_plan_revision: change.revision + 1,
      ...(control === "cancelled"
        ? {
            status: "cancelled",
            outcome: "Cancelled future steps. Completed effects remain recorded.",
            finished_at: new Date().toISOString(),
            lease_owner: null,
            lease_expires_at: null,
          }
        : {}),
      ...(control === "running"
        ? { next_check_at: new Date().toISOString(), next_check_reason: "Member resumed the plan" }
        : { next_check_at: null, next_check_reason: "Member paused the plan" }),
    })
    .eq("id", change.workItemId)
    .eq("agent_plan_revision", change.revision)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data) throw new Error("Work changed before this control was applied");
  await recordAudit(db, {
    actorEmail: email,
    action: `agent_work.${change.control}`,
    entityType: "work_item",
    entityId: change.workItemId,
    source: "admin",
  });
  return {
    workItemId: change.workItemId,
    control,
    revision: change.revision + 1,
    authorization: { mode: "delegated_work", scope: "work_orchestration" },
  };
}
async function currentDelegation(db: SupabaseClient, item: WorkItem) {
  const latest = await db
    .from("work_items")
    .select("*")
    .eq("id", item.id)
    .eq("kind", "agent_work")
    .maybeSingle();
  if (latest.error || !latest.data) throw new Error("Work delegation is unavailable");
  const plan = progressSchema.parse(latest.data.agent_plan);
  const [member, tenant] = await Promise.all([
    db
      .from("tenant_memberships")
      .select("status,role")
      .eq("user_id", plan.requesterId)
      .eq("tenant_id", item.tenant_id)
      .maybeSingle(),
    db.from("tenants").select("status,config").eq("id", item.tenant_id).maybeSingle(),
  ]);
  const user = await db.auth.admin.getUserById(plan.requesterId);
  if (
    member.error ||
    member.data?.status !== "active" ||
    member.data?.role !== "admin" ||
    tenant.error ||
    tenant.data?.status !== "active" ||
    user.error ||
    user.data.user?.email !== plan.requesterEmail
  )
    throw new Error("Requesting member or tenant is no longer active");
  if (plan.control !== "running" || latest.data.status === "cancelled")
    throw new Error(`Work is ${plan.control}`);
  return { item: latest.data as WorkItem, plan, config: tenant.data.config };
}
async function checkpoint(db: SupabaseClient, item: WorkItem, plan: Progress) {
  const result = await db
    .from("work_items")
    .update({ agent_plan: plan, agent_plan_revision: item.agent_plan_revision! + 1 })
    .eq("id", item.id)
    .eq("agent_plan_revision", item.agent_plan_revision!)
    .eq("lease_owner", item.lease_owner!)
    .eq("attempt_count", item.attempt_count)
    .select("*")
    .maybeSingle();
  if (result.error || !result.data)
    throw new Error("Work checkpoint was superseded; no further step may run");
  return result.data as WorkItem;
}
export function registerAgentWorkHandler() {
  registerWorkKindHandler("agent_work", async (db, claimed, signal): Promise<WorkResult> => {
    const latest = await db.from("work_items").select("agent_plan").eq("id", claimed.id).single();
    if (latest.data?.agent_plan?.control === "paused")
      return deferWork("Plan is paused", new Date(Date.now() + 86400000).toISOString());
    let { item, plan, config } = await currentDelegation(db, claimed);
    const index = plan.steps.findIndex((step) => step.status !== "completed");
    if (index < 0)
      return {
        status: "completed",
        outcome: "All ordered steps and their action receipts are complete",
        value: plan,
      };
    const step = plan.steps[index]!;
    if (step.status === "needs_attention")
      return reconcileWork(
        step.receipt || "This step needs review; it will not replay automatically",
      );
    if (step.status === "awaiting_approval") {
      const receipts = await db
        .from("action_queue")
        .select("id,status,result,error")
        .in("id", step.actionIds);
      if (receipts.error || receipts.data?.length !== step.actionIds.length)
        return reconcileWork("Action receipts are unavailable");
      if (
        receipts.data.some((row) =>
          ["failed", "rejected", "expired", "denied"].includes(row.status),
        )
      ) {
        step.status = "needs_attention";
        step.receipt =
          "A required action failed or was declined. Completed effects remain recorded.";
        await checkpoint(db, item, plan);
        return reconcileWork(step.receipt);
      }
      if (
        receipts.data.some(
          (row) =>
            row.status === "executed" &&
            (row.result?.complete === false ||
              ["partial", "failed", "pending"].includes(row.result?.status)),
        )
      )
        return reconcileWork(
          "A linked action has an incomplete result; inspect its receipt before continuing",
        );
      if (!receipts.data.every((row) => row.status === "executed"))
        return {
          ...deferWork(
            "Waiting for your exact action decision",
            new Date(Date.now() + 60000).toISOString(),
          ),
          status: "awaiting_approval",
          artifacts: step.actionIds.map((id) => ({ type: "action", id })),
        };
      step.status = "completed";
      item = await checkpoint(db, item, plan);
      return deferWork("Approved step completed; continue the next step", new Date().toISOString());
    }
    // A interrupted model run can have staged or executed effects. Preserve it for
    // reconciliation rather than guessing that re-running the instruction is safe.
    if (step.status === "running")
      return reconcileWork(
        `Interrupted step ${index + 1}. Inspect run ${step.runId ?? "unknown"} and linked action receipts before requesting new work.`,
      );
    step.status = "running";
    item = await checkpoint(db, item, plan);
    const { runRevenueCommandAgent } = await import("./ai-agent");
    let modelCalls = 0;
    const result = await runRevenueCommandAgent(
      db,
      plan.requesterEmail,
      [
        {
          role: "user",
          content: `Work objective: ${plan.objective}\nCurrent step ${index + 1}: ${step.instruction}\nPrior receipts: ${plan.steps
            .slice(0, index)
            .map((s) => s.receipt)
            .join(
              "\n",
            )}\nComplete only this step. Do not create another delegated plan. Report missing capabilities explicitly.`,
        },
      ],
      {
        surface: "agent_work",
        conversationId: plan.conversationId,
        workItemId: item.id,
        requesterId: plan.requesterId,
        tenantConfig: config,
        signal,
        excludeTools: [
          "start_agent_work",
          "control_agent_work",
          "preview_internal_permission",
          "propose_internal_permission",
        ],
        beforeAttempt: async () => {
          await currentDelegation(db, item);
          const limits = await checkBudgets(db, {
            coworkerId: "*",
            workItemId: item.id,
            budgetKinds: ["vendor_api_calls"],
          });
          if (!limits.some((budget) => Number.isFinite(budget.limit) && budget.allowed))
            throw new Error("Finite AI call budget is unavailable");
          await claimResourceBudget(db, {
            coworkerId: "*",
            budgetKind: "vendor_api_calls",
            amount: 1,
            operationKey: `agent-work:${item.id}:${index}:${item.attempt_count}:${modelCalls++}`,
            workItemId: item.id,
          });
        },
        beforeTool: async () => {
          await currentDelegation(db, item);
        },
        onRunStarted: async ({ runId }) => {
          if (!runId)
            throw new Error("A durable run receipt could not be saved; no model call was made");
          step.runId = runId;
          item = await checkpoint(db, item, plan);
        },
        onProposalStaged: (proposal) => {
          step.actionIds.push(proposal.id);
        },
        onActionReceipt: (receipt) => {
          step.actionIds.push(receipt.actionId);
        },
      },
    );
    step.receipt = result.text.slice(0, 12000);
    step.status = step.actionIds.length
      ? "awaiting_approval"
      : result.status === "completed"
        ? "completed"
        : "needs_attention";
    await checkpoint(db, item, plan);
    if (step.status === "needs_attention") return reconcileWork(step.receipt);
    if (step.status === "awaiting_approval")
      return {
        ...deferWork(
          "Review the exact changes in the conversation",
          new Date(Date.now() + 60000).toISOString(),
        ),
        status: "awaiting_approval",
        artifacts: step.actionIds.map((id) => ({ type: "action", id })),
      };
    return deferWork(`Step ${index + 1} completed; continue the plan`, new Date().toISOString());
  });
}
