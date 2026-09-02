import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimApprovedAction, failAction, finishAction } from "./actions";
import { sendRecordedEmail } from "./communications";
import { transitionOpportunity } from "./pipeline";
import { activateCampaign } from "./campaigns";
import { sendGmailReply } from "./google";
import { REVENUE_STAGES, type RevenueStage } from "./types";
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
) {
  const action = await claimApprovedAction(supabase, id, actorEmail);
  const payload = action.payload as Record<string, unknown>;
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
        if (!REVENUE_STAGES.includes(stage as RevenueStage))
          throw new Error("Invalid pipeline stage");
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
          to: stage as RevenueStage,
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
        break;
      }
      case "update_task": {
        const taskId = stringValue(payload, "taskId")!;
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
        const { data, error } = await supabase
          .from("opportunities")
          .update({
            next_action: stringValue(payload, "nextAction")!,
            next_action_at: stringValue(payload, "nextActionAt", false) ?? null,
          })
          .eq("id", stringValue(payload, "opportunityId")!)
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
    return result;
  } catch (error) {
    await failAction(supabase, id, error instanceof Error ? error.message : "Action failed");
    throw error;
  }
}
