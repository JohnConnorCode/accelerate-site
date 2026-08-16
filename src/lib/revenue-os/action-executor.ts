import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimApprovedAction, failAction, finishAction } from "./actions";
import { sendRecordedEmail } from "./communications";
import { transitionOpportunity } from "./pipeline";
import { activateCampaign } from "./campaigns";
import { sendGmailReply } from "./google";
import { REVENUE_STAGES, type RevenueStage } from "./types";

function stringValue(payload: Record<string, unknown>, key: string, required = true): string | undefined {
  const value = typeof payload[key] === "string" ? payload[key].trim() : "";
  if (required && !value) throw new Error(`${key} is required`);
  return value || undefined;
}

export const APPROVABLE_ACTIONS = ["send_email", "send_gmail_reply", "transition_opportunity", "create_task", "update_next_action", "activate_campaign"] as const;

export async function approveAndExecuteAction(supabase: SupabaseClient, id: string, actorEmail: string) {
  const action = await claimApprovedAction(supabase, id, actorEmail);
  const payload = action.payload as Record<string, unknown>;
  try {
    let result: unknown;
    switch (action.action_type) {
      case "send_email":
        result = await sendRecordedEmail(supabase, {
          to: stringValue(payload, "to")!,
          subject: stringValue(payload, "subject")!,
          text: stringValue(payload, "body")!,
          contactId: stringValue(payload, "contactId", false),
          opportunityId: stringValue(payload, "opportunityId", false),
          actorEmail,
          source: "ai",
        });
        break;
      case "send_gmail_reply":
        result = await sendGmailReply(supabase, {
          conversationId: stringValue(payload, "conversationId")!,
          body: stringValue(payload, "body")!,
          actorEmail,
        });
        break;
      case "transition_opportunity": {
        const stage = stringValue(payload, "stage")!;
        if (!REVENUE_STAGES.includes(stage as RevenueStage)) throw new Error("Invalid pipeline stage");
        result = await transitionOpportunity(supabase, {
          id: stringValue(payload, "opportunityId")!,
          to: stage as RevenueStage,
          actorEmail,
          source: "ai",
          reason: stringValue(payload, "reason", false),
          lossReason: stringValue(payload, "lossReason", false),
        });
        break;
      }
      case "create_task": {
        const { data, error } = await supabase.from("tasks").insert({
          title: stringValue(payload, "title")!,
          description: stringValue(payload, "description", false) ?? null,
          due_date: stringValue(payload, "dueDate", false) ?? null,
          priority: ["high", "medium", "low"].includes(String(payload.priority)) ? payload.priority : "medium",
          opportunity_id: stringValue(payload, "opportunityId", false) ?? null,
          source: "ai",
          dedupe_key: stringValue(payload, "dedupeKey", false) ?? null,
        }).select("id").single();
        if (error) throw new Error(error.message);
        result = data;
        break;
      }
      case "update_next_action": {
        const { data, error } = await supabase.from("opportunities").update({
          next_action: stringValue(payload, "nextAction")!,
          next_action_at: stringValue(payload, "nextActionAt", false) ?? null,
        }).eq("id", stringValue(payload, "opportunityId")!).select("id,next_action,next_action_at").single();
        if (error) throw new Error(error.message);
        result = data;
        break;
      }
      case "activate_campaign":
        result = await activateCampaign(supabase, stringValue(payload, "campaignId")!, actorEmail);
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
