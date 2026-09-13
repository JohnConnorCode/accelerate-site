import { bulkEnrollContacts, bulkSuppressContacts, bulkTagContacts } from "./contact-bulk";
import { executeRadarOutreach } from "./radar-outreach";
import "server-only";
import { executeRadarRelationship } from "./radar-relationships";
import { executeRadarAssessment } from "./radar-ranking";
import { executeRadarStoreChange } from "./radar-store";
import { executeModuleConfiguration } from "./module-actions";
import { executeWorkspaceBrandUpdate } from "./branding-actions";
import { executeTodayViewChange } from "./today-views";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCollectionReminder } from "./collection-reminders";
import { executeInvoicePagePublication } from "./invoice-pages";
import { executeWorkflowTaskBatch } from "./workflow-tasks";
import { executeStripeInvoiceAction } from "./stripe-invoicing";
import { assertPluginActionAllowed } from "./workflow-plugins";
import {
  claimApprovedAction,
  denyAction,
  failAction,
  finishAction,
  proposeAction,
} from "./actions";
import { executeRuntimeAction } from "./runtime-actions";
import { checkAutonomy } from "./autonomy-policy";
import { recordAudit } from "./audit";
import { reversibilityOf } from "./action-reversibility";
import { sendRecordedEmail } from "./communications";
import { transitionOpportunity } from "./pipeline";
import { activateCampaign, duplicateCampaign } from "./campaigns";
import { sendGmailReply } from "./google";
import {
  createRevenueTask,
  completeOperatorTask,
  snoozeOperatorTask,
  updateOperatorTask,
  patchOperatorTask,
  deleteOperatorTask,
} from "./tasks";
import { applyLayoutChange } from "./admin-layout";
import { captureFounderNote } from "./notes";

function stringValue(
  payload: Record<string, unknown>,
  key: string,
  required = true,
): string | undefined {
  const value = typeof payload[key] === "string" ? payload[key].trim() : "";
  if (required && !value) throw new Error(`${key} is required`);
  return value || undefined;
}

export const APPROVABLE_ACTIONS = [
  "today_view_change",
  "send_radar_outreach",
  "review_radar_relationship",
  "review_radar_assessment",
  "update_radar_store",
  "update_module_configuration",
  "update_workspace_brand",
  "create_stripe_invoice_draft",
  "send_stripe_invoice",
  "create_task_batch",
  "publish_invoice_page",
  "bootstrap_coworker",
  "store_agent_memory",
  "record_learned_policy",
  "approve_learning",
  "send_collection_reminder",
  "send_email",
  "send_gmail_reply",
  "transition_opportunity",
  "create_task",
  "update_task",
  "delete_task",
  "update_next_action",
  "activate_campaign",
  "duplicate_campaign",
  "bulk_tag_contacts",
  "bulk_suppress_contacts",
  "bulk_enroll_contacts",
  "admin_layout_change",
  "create_founder_note",
  "identity_review",
] as const;

export async function approveAndExecuteAction(
  supabase: SupabaseClient,
  id: string,
  actorEmail: string,
  options?: { mode?: "approved" | "autonomous" },
) {
  const mode = options?.mode ?? "approved";
  const action = await claimApprovedAction(supabase, id, actorEmail, mode);
  // Unknown types fail closed with the executor's own error before any
  // other gate, preserving the long-standing message contract.
  if (!(APPROVABLE_ACTIONS as readonly string[]).includes(String(action.action_type))) {
    await failAction(
      supabase,
      id,
      `Action type ${action.action_type} is not registered for execution`,
    );
    throw new Error(`Action type ${action.action_type} is not registered for execution`);
  }
  const reversibility = reversibilityOf(String(action.action_type)).reversibility;
  // Irreversible effects leave the system, so they are permanently
  // non-autonomous: the trust ladder has nothing to special-case because the
  // executor itself refuses the autonomous mode. Human-approved runs pass.
  if (reversibility === "irreversible" && mode === "autonomous") {
    await failAction(
      supabase,
      id,
      `${action.action_type} is irreversible and requires human approval; it cannot run autonomously`,
    );
    throw new Error(
      `${action.action_type} is irreversible and requires human approval; it cannot run autonomously`,
    );
  }
  const payload = action.payload as Record<string, unknown>;
  // Inverse data for compensateAction, captured as the execution proceeds.
  // Written to the action row afterwards; the migration that adds the
  // reversibility/compensation/evidence columns must be applied before this
  // code runs against a real database (release flow runs migrations first).
  const compensation: Record<string, unknown> = {};
  try {
    if (action.source_context === "plugin" || payload.pluginOrigin)
      await assertPluginActionAllowed(supabase, String(action.action_type), payload, mode);
    const coworkerId =
      typeof action.proposed_by === "string" && action.proposed_by.startsWith("coworker:")
        ? action.proposed_by.slice("coworker:".length)
        : null;
    const policy = await checkAutonomy(supabase, String(action.action_type), coworkerId);
    // The policy is re-resolved here, after the claim, so authority revoked
    // between approval and execution denies with a truthful `denied` receipt
    // instead of a generic failure. denyAction closes the row; the marker
    // below keeps the catch from overwriting it with failAction.
    if (
      policy.hardFloor ||
      policy.level === "prohibited" ||
      (mode === "autonomous" && (!policy.allowed || policy.level !== "standing_permission"))
    ) {
      await denyAction(supabase, id, {
        code: "autonomy_denied",
        reason: `Action denied: ${policy.reason}`,
        policy: {
          policy_id: policy.policyId,
          action_key: policy.actionKey,
          level: policy.level,
          mode,
        },
      });
      const denial = new Error(`Action denied: ${policy.reason}`);
      (denial as Error & { actionDenied?: boolean }).actionDenied = true;
      throw denial;
    }
    await recordAudit(supabase, {
      actorEmail,
      action: "action.authorized",
      entityType: "action_queue",
      entityId: id,
      source: mode === "approved" ? "admin" : "automation",
      metadata: {
        policy_id: policy.policyId,
        action_key: policy.actionKey,
        level: policy.level,
        mode,
        coworker_id: coworkerId,
      },
    });
    let result: unknown;
    switch (action.action_type) {
      case "send_radar_outreach": {
        result = await executeRadarOutreach(supabase, id, actorEmail);
        break;
      }
      case "review_radar_relationship": {
        if (mode !== "approved")
          throw new Error("Relationship assertions require exact human approval");
        result = await executeRadarRelationship(supabase, payload, actorEmail);
        break;
      }
      case "review_radar_assessment": {
        if (mode !== "approved")
          throw new Error("Radar estimates and classification require human approval");
        result = await executeRadarAssessment(supabase, payload, actorEmail);
        break;
      }
      case "update_radar_store": {
        if (mode !== "approved")
          throw new Error("Radar source and opportunity changes require human approval");
        result = await executeRadarStoreChange(supabase, payload, actorEmail);
        break;
      }
      case "update_module_configuration": {
        if (mode !== "approved")
          throw new Error("Module configuration changes require human approval");
        result = await executeModuleConfiguration(supabase, payload, actorEmail);
        break;
      }
      case "update_workspace_brand": {
        if (mode !== "approved") throw new Error("Branding changes require human approval");
        result = await executeWorkspaceBrandUpdate(supabase, payload, actorEmail);
        break;
      }
      case "today_view_change": {
        if (mode !== "approved") throw new Error("Today view changes require human approval");
        result = await executeTodayViewChange(supabase, payload);
        break;
      }
      case "publish_invoice_page": {
        if (mode !== "approved")
          throw new Error("Invoice page publication requires human approval");
        result = await executeInvoicePagePublication(supabase, id, actorEmail);
        break;
      }
      case "create_task_batch": {
        if (mode !== "approved") throw new Error("Task workflows require human approval");
        result = await executeWorkflowTaskBatch(supabase, id, actorEmail);
        break;
      }
      case "create_stripe_invoice_draft":
      case "send_stripe_invoice": {
        if (mode !== "approved") throw new Error("Invoice actions require human approval");
        result = await executeStripeInvoiceAction(supabase, id, actorEmail);
        break;
      }
      case "bootstrap_coworker":
      case "store_agent_memory":
      case "record_learned_policy":
      case "approve_learning": {
        if (mode !== "approved")
          throw new Error("Runtime configuration and memory changes require human approval");
        if (action.action_type === "approve_learning") {
          const { approveLearningProposal } = await import("./learning-inbox");
          const proposalId = payload.proposalId;
          if (typeof proposalId !== "string" || !proposalId)
            throw new Error("approve_learning requires a proposalId payload");
          result = await approveLearningProposal(supabase, {
            proposalId,
            actorEmail,
          });
          break;
        }
        result = await executeRuntimeAction(supabase, action.action_type, payload, actorEmail);
        break;
      }
      case "send_collection_reminder": {
        if (mode !== "approved") throw new Error("Collection reminders require human approval");
        result = await executeCollectionReminder(supabase, id, actorEmail);
        break;
      }
      case "send_email": {
        const contactId = stringValue(payload, "contactId", false);
        if (contactId) {
          const { data: contact, error: contactError } = await supabase
            .from("contacts")
            .select("id,unsubscribed")
            .eq("id", contactId)
            .maybeSingle();
          if (contactError) throw new Error(contactError.message);
          if (contact && contact.unsubscribed) {
            throw new Error("Cannot send email: contact has unsubscribed");
          }
        }
        result = await sendRecordedEmail(supabase, {
          to: stringValue(payload, "to")!,
          subject: stringValue(payload, "subject")!,
          text: stringValue(payload, "body")!,
          contactId,
          opportunityId: stringValue(payload, "opportunityId", false),
          actorEmail,
          source: "ai",
          idempotencyKey: `action:${id}`,
        });
        break;
      }
      case "send_gmail_reply": {
        const conversationId = stringValue(payload, "conversationId")!;
        const { data: conv, error: convError } = await supabase
          .from("conversations")
          .select("id,status")
          .eq("id", conversationId)
          .maybeSingle();
        if (convError) throw new Error(convError.message);
        if (conv && conv.status === "archived") {
          throw new Error("Cannot send reply: conversation is archived");
        }
        result = await sendGmailReply(supabase, {
          conversationId,
          body: stringValue(payload, "body")!,
          actorEmail,
          idempotencyKey: `action:${id}`,
        });
        break;
      }
      case "transition_opportunity": {
        const stage = stringValue(payload, "stage")!;
        const oppId = stringValue(payload, "opportunityId")!;
        const { data: currentOpp, error: oppError } = await supabase
          .from("opportunities")
          .select("id,stage")
          .eq("id", oppId)
          .maybeSingle();
        if (oppError) throw new Error(oppError.message);
        if (!currentOpp) {
          throw new Error("Target opportunity not found");
        }
        if (payload.expectedStage && currentOpp.stage !== payload.expectedStage) {
          throw new Error(
            `Underlying opportunity state changed: expected stage "${payload.expectedStage}", but currently "${currentOpp.stage}". Proposal has expired.`,
          );
        }
        if (currentOpp.stage === stage) {
          throw new Error(`Opportunity is already in stage "${stage}"`);
        }
        result = await transitionOpportunity(supabase, {
          id: oppId,
          to: stage,
          actorEmail,
          source: "ai",
          reason: stringValue(payload, "reason", false),
          lossReason: stringValue(payload, "lossReason", false),
        });
        break;
      }
      case "create_task": {
        result = await createRevenueTask(supabase, {
          title: stringValue(payload, "title")!,
          description: stringValue(payload, "description", false),
          dueDate: stringValue(payload, "dueDate", false),
          dueTime: stringValue(payload, "dueTime", false),
          priority: ["high", "medium", "low"].includes(String(payload.priority))
            ? (payload.priority as "high" | "medium" | "low")
            : "medium",
          opportunityId: stringValue(payload, "opportunityId", false),
          relatedType:
            typeof payload.relatedType === "string" ? (payload.relatedType as string) : null,
          relatedId: typeof payload.relatedId === "string" ? (payload.relatedId as string) : null,
          relatedName:
            typeof payload.relatedName === "string" ? (payload.relatedName as string) : null,
          source: typeof payload.source === "string" && payload.source ? payload.source : "ai",
          dedupeKey: stringValue(payload, "dedupeKey", false) ?? `action:${id}`,
          actorEmail,
        });
        compensation.createdTaskId = (result as { task?: { id?: unknown } })?.task?.id ?? null;
        break;
      }
      case "update_task": {
        const taskId = stringValue(payload, "taskId")!;
        const { data: taskBefore } = await supabase
          .from("tasks")
          .select("id,title,description,priority,due_date,status,snoozed_until,completed_at")
          .eq("id", taskId)
          .maybeSingle();
        // Copy primitives now: some clients hand back live row references
        // that later writes mutate in place, which would poison the inverse.
        const before = taskBefore as Record<string, unknown> | null;
        compensation.before = before
          ? {
              title: before.title,
              description: before.description ?? null,
              priority: before.priority,
              due_date: before.due_date ?? null,
              status: before.status,
              snoozed_until: before.snoozed_until ?? null,
              completed_at: before.completed_at ?? null,
            }
          : null;
        const changeType = stringValue(payload, "changeType")!;
        if (changeType === "complete") {
          result = await completeOperatorTask(supabase, { id: taskId, actorEmail });
        } else if (changeType === "snooze") {
          result = await snoozeOperatorTask(supabase, {
            id: taskId,
            until: stringValue(payload, "until")!,
            actorEmail,
          });
        } else if (changeType === "reopen") {
          result = await patchOperatorTask(
            supabase,
            { id: taskId, status: "pending", actorEmail },
            false,
          );
        } else if (changeType === "edit") {
          const priorityRaw = payload.priority;
          const descriptionRaw = payload.description;
          result = await updateOperatorTask(supabase, {
            id: taskId,
            title: stringValue(payload, "title", false),
            description:
              descriptionRaw === null
                ? null
                : descriptionRaw === undefined
                  ? undefined
                  : stringValue(payload, "description", false),
            priority: ["high", "medium", "low"].includes(String(priorityRaw))
              ? (priorityRaw as "high" | "medium" | "low")
              : undefined,
            dueDate:
              payload.dueDate === null
                ? null
                : (stringValue(payload, "dueDate", false) ?? undefined),
            actorEmail,
          });
        } else {
          throw new Error(`Unknown task update changeType "${changeType}"`);
        }
        break;
      }
      case "delete_task": {
        if (mode !== "approved") throw new Error("Task deletion requires human approval");
        const taskId = stringValue(payload, "taskId")!;
        const { data: deletedBefore, error: deletedReadError } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", taskId)
          .maybeSingle();
        if (deletedReadError) throw new Error(deletedReadError.message);
        if (!deletedBefore) throw new Error("Target task not found");
        // Copy primitives now (see update_task above): the delete removes the
        // row, so the inverse must own its own snapshot, not a live reference.
        compensation.deletedRow = JSON.parse(JSON.stringify(deletedBefore)) as Record<
          string,
          unknown
        >;
        await deleteOperatorTask(supabase, taskId, actorEmail);
        result = { deleted: taskId };
        break;
      }
      case "update_next_action": {
        const opportunityId = stringValue(payload, "opportunityId")!;
        const { data: actionBefore } = await supabase
          .from("opportunities")
          .select("next_action,next_action_at")
          .eq("id", opportunityId)
          .maybeSingle();
        // Copy primitives now (see update_task above): live references would
        // reflect the update we are about to make, not the prior state.
        const priorRow = actionBefore as Record<string, unknown> | null;
        compensation.prior = priorRow
          ? {
              next_action: priorRow.next_action ?? null,
              next_action_at: priorRow.next_action_at ?? null,
            }
          : null;
        const { data, error } = await supabase
          .from("opportunities")
          .update({
            next_action: stringValue(payload, "nextAction")!,
            next_action_at: stringValue(payload, "nextActionAt", false) ?? null,
          })
          .eq("id", opportunityId)
          .select("id,next_action,next_action_at")
          .single();
        if (error) throw new Error(error.message);
        result = data;
        break;
      }
      case "activate_campaign": {
        const campaignId = stringValue(payload, "campaignId")!;
        const { data: campaign, error: campError } = await supabase
          .from("campaigns")
          .select("id,status,version,approved_version")
          .eq("id", campaignId)
          .maybeSingle();
        if (campError) throw new Error(campError.message);
        if (!campaign) {
          throw new Error("Target campaign not found");
        }
        if (campaign.status === "active") {
          throw new Error("Campaign is already active");
        }
        if (
          typeof payload.expectedVersion === "number" &&
          campaign.version !== payload.expectedVersion
        ) {
          throw new Error(
            `Campaign version changed from ${payload.expectedVersion} to ${campaign.version} since proposal. Re-approval required.`,
          );
        }
        result = await activateCampaign(supabase, campaignId, actorEmail);
        break;
      }
      case "bulk_tag_contacts": {
        result = await bulkTagContacts(supabase, {
          contactIds: payload.contactIds,
          add: payload.add,
          remove: payload.remove,
          actorEmail,
        });
        break;
      }
      case "bulk_suppress_contacts": {
        result = await bulkSuppressContacts(supabase, {
          contactIds: payload.contactIds,
          actorEmail,
        });
        break;
      }
      case "bulk_enroll_contacts": {
        result = await bulkEnrollContacts(supabase, {
          campaignId: stringValue(payload, "campaignId")!,
          contactIds: payload.contactIds,
          actorEmail,
        });
        break;
      }
      case "duplicate_campaign": {
        const campaignId = stringValue(payload, "campaignId")!;
        result = await duplicateCampaign(supabase, campaignId, actorEmail, {
          requestId: id,
          expectedVersion: payload.expectedVersion as number,
          ...(typeof payload.name === "string" ? { name: payload.name } : {}),
        });
        break;
      }
      case "admin_layout_change":
        result = await applyLayoutChange(supabase, {
          scope: stringValue(payload, "scope")!,
          doc: payload.doc,
          actorEmail,
          tenantId: String((action as Record<string, unknown>).tenant_id ?? ""),
        });
        break;
      case "create_founder_note":
        result = await captureFounderNote(supabase, {
          requestId: id,
          body: stringValue(payload, "body")!,
          actorEmail,
          contactId: stringValue(payload, "contactId", false) ?? null,
          companyId: stringValue(payload, "companyId", false) ?? null,
          opportunityId: stringValue(payload, "opportunityId", false) ?? null,
          captureSource: "ai_answer",
        });
        break;
      case "identity_review":
        // Identity is never resolved by a generic approval: the founder's
        // link/create/no-match/defer choice lives in the review workbench,
        // which owns the claim. Fail closed and point there.
        throw new Error("Resolve this item in the Identity review workbench");
      default:
        throw new Error(`Action type ${action.action_type} is not registered for execution`);
    }
    // Stamp the reversibility class and captured inverse. Tolerates only the
    // missing-column error on trees whose migration has not applied yet; the
    // compensator then refuses for missing data instead of guessing.
    const { error: stampError } = await supabase
      .from("action_queue")
      .update({ reversibility, compensation })
      .eq("id", id);
    if (stampError && (stampError as { code?: string }).code !== "42703")
      throw new Error(stampError.message);
    await finishAction(supabase, id, result);
    return result;
  } catch (error) {
    // A denial already wrote its terminal receipt; failAction would find no
    // `executing` row and mask the denial with a superseded error.
    if (!(error instanceof Error && (error as Error & { actionDenied?: boolean }).actionDenied))
      await failAction(supabase, id, error instanceof Error ? error.message : "Action failed");
    throw error;
  }
}

/**
 * Single write path for operator task UI adapters (and any programmatic
 * caller that wants the same guarantees): the write is proposed into
 * action_queue and executed by approveAndExecuteAction, so UI saves carry
 * the same claim, autonomy re-check, audit, idempotency, reversibility
 * stamp and truthful receipt as programmatic writes. HTTP adapters never
 * touch task rows; they only translate request bodies into this call.
 */
export async function executeTaskWrite(
  supabase: SupabaseClient,
  input:
    | {
        kind: "create";
        title: string;
        description?: string | null;
        dueDate?: string | null;
        dueTime?: string | null;
        priority?: "high" | "medium" | "low";
        opportunityId?: string | null;
        relatedType?: string | null;
        relatedId?: string | null;
        relatedName?: string | null;
      }
    | {
        kind: "complete" | "reopen";
        taskId: string;
      }
    | {
        kind: "snooze";
        taskId: string;
        until?: string;
      }
    | {
        kind: "edit";
        taskId: string;
        title?: string;
        description?: string | null;
        priority?: "high" | "medium" | "low";
        dueDate?: string | null;
      }
    | { kind: "delete"; taskId: string },
  actorEmail: string,
): Promise<unknown> {
  const payload: Record<string, unknown> = {};
  let actionType: string;
  let title: string;
  if (input.kind === "create") {
    actionType = "create_task";
    title = input.title;
    payload.title = input.title;
    payload.source = "manual";
    if (input.description !== undefined) payload.description = input.description;
    if (input.dueDate !== undefined) payload.dueDate = input.dueDate;
    if (input.dueTime !== undefined) payload.dueTime = input.dueTime;
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.opportunityId !== undefined) payload.opportunityId = input.opportunityId;
    if (input.relatedType != null) payload.relatedType = input.relatedType;
    if (input.relatedId != null) payload.relatedId = input.relatedId;
    if (input.relatedName != null) payload.relatedName = input.relatedName;
  } else if (input.kind === "delete") {
    actionType = "delete_task";
    title = `Delete task ${input.taskId}`;
    payload.taskId = input.taskId;
  } else {
    actionType = "update_task";
    title = `Update task ${input.taskId}`;
    payload.taskId = input.taskId;
    switch (input.kind) {
      case "complete":
      case "reopen":
        payload.changeType = input.kind;
        break;
      case "snooze":
        payload.changeType = "snooze";
        payload.until = input.until;
        break;
      default:
        payload.changeType = "edit";
        if (input.title !== undefined) payload.title = input.title;
        if (input.description !== undefined) payload.description = input.description;
        if (input.priority !== undefined) payload.priority = input.priority;
        if (input.dueDate !== undefined) payload.dueDate = input.dueDate;
        break;
    }
  }
  const proposed = (await proposeAction(supabase, {
    actionType,
    title,
    payload,
    sourceContext: "admin-ui",
    proposedBy: `human:${actorEmail}`,
  })) as { id: string };
  return approveAndExecuteAction(supabase, proposed.id, actorEmail, { mode: "approved" });
}
