import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimApprovedAction, failAction, finishAction } from "./actions";
import { reversibilityOf } from "./action-reversibility";
import { sendRecordedEmail } from "./communications";
import { transitionOpportunity } from "./pipeline";
import { activateCampaign } from "./campaigns";
import { sendGmailReply } from "./google";
import {
  createRevenueTask,
  completeOperatorTask,
  snoozeOperatorTask,
  updateOperatorTask,
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
  "send_email",
  "send_gmail_reply",
  "transition_opportunity",
  "create_task",
  "update_task",
  "update_next_action",
  "activate_campaign",
  "admin_layout_change",
  "create_founder_note",
] as const;

export async function approveAndExecuteAction(
  supabase: SupabaseClient,
  id: string,
  actorEmail: string,
  options?: { mode?: "approved" | "autonomous" },
) {
  const mode = options?.mode ?? "approved";
  const action = await claimApprovedAction(supabase, id, actorEmail);
  // Unknown types fail closed with the executor's own error before any
  // other gate, preserving the long-standing message contract.
  if (!(APPROVABLE_ACTIONS as readonly string[]).includes(String(action.action_type))) {
    await failAction(supabase, id, `Action type ${action.action_type} is not registered for execution`);
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
    let result: unknown;
    switch (action.action_type) {
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
          priority: ["high", "medium", "low"].includes(String(payload.priority))
            ? (payload.priority as "high" | "medium" | "low")
            : "medium",
          opportunityId: stringValue(payload, "opportunityId", false),
          source: "ai",
          dedupeKey: stringValue(payload, "dedupeKey", false),
          actorEmail,
        });
        compensation.createdTaskId = (result as { task?: { id?: unknown } })?.task?.id ?? null;
        break;
      }
      case "update_task": {
        const taskId = stringValue(payload, "taskId")!;
        const { data: taskBefore } = await supabase
          .from("tasks")
          .select("id,title,priority,due_date,status,snoozed_until,completed_at")
          .eq("id", taskId)
          .maybeSingle();
        // Copy primitives now: some clients hand back live row references
        // that later writes mutate in place, which would poison the inverse.
        const before = taskBefore as Record<string, unknown> | null;
        compensation.before = before
          ? {
              title: before.title,
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
        } else if (changeType === "edit") {
          const priorityRaw = payload.priority;
          result = await updateOperatorTask(supabase, {
            id: taskId,
            title: stringValue(payload, "title", false),
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
      case "admin_layout_change":
        result = await applyLayoutChange(supabase, {
          scope: stringValue(payload, "scope")!,
          doc: payload.doc,
          actorEmail,
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
      default:
        throw new Error(`Action type ${action.action_type} is not registered for execution`);
    }
    await finishAction(supabase, id, result);
    // Stamp the reversibility class and captured inverse. Tolerates only the
    // missing-column error on trees whose migration has not applied yet; the
    // compensator then refuses for missing data instead of guessing.
    const { error: stampError } = await supabase
      .from("action_queue")
      .update({ reversibility, compensation })
      .eq("id", id);
    if (stampError && (stampError as { code?: string }).code !== "42703") throw new Error(stampError.message);
    return result;
  } catch (error) {
    await failAction(supabase, id, error instanceof Error ? error.message : "Action failed");
    throw error;
  }
}
