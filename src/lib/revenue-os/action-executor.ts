import { bulkEnrollContacts, bulkSuppressContacts, bulkTagContacts } from "./contact-bulk";
import { executeRadarOutreach } from "./radar-outreach";
import "server-only";
import { systemSourceForDatabase } from "@/lib/supabase/server";
import type { RevenueTaskInput } from "./tasks";
import { executeRadarRelationship } from "./radar-relationships";
import { executeRadarAssessment } from "./radar-ranking";
import { executeSocialChange } from "./social-marketing";
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
import { applyConversationEffect } from "./conversations";
import { applyPipelineEffect } from "./pipeline";
import { activateCampaign, duplicateCampaign } from "./campaigns";
import { sendGmailReply } from "./google";
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
  "social_marketing_change",
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
  "update_conversation_status",
  "assign_conversation",
  "link_conversation_record",
  "transition_opportunity",
  "update_opportunity_details",
  "create_opportunity",
  "update_opportunity_record",
  "update_opportunity_intake",
  "reorder_opportunities",
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
      case "social_marketing_change": {
        if (mode !== "approved") throw new Error("Social publishing requires exact human approval");
        result = await executeSocialChange(supabase, payload, actorEmail, id);
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
      case "update_conversation_status":
      case "assign_conversation":
      case "link_conversation_record":
        return await applyConversationEffect(supabase, id, String(action.action_type), payload, actorEmail);
      case "transition_opportunity":
      case "update_opportunity_details":
      case "create_opportunity":
      case "update_opportunity_record":
      case "update_opportunity_intake":
      case "reorder_opportunities":
        return await applyPipelineEffect(
          supabase,
          String(action.action_type),
          payload,
          actorEmail,
          id,
        );
      case "create_task":
      case "update_task":
      case "delete_task":
      case "update_next_action": {
        // The local effect, inverse and terminal receipt share one transaction.
        const { data, error } = await supabase.rpc("apply_local_action", {
          p_id: id,
          p_payload: payload,
          p_actor: actorEmail,
          p_undo: false,
        });
        if (error) throw new Error(error.message);
        return data;
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

/** Operator decisions stage the same proposal as AI; the authenticated UI approves it. */
export async function runOperatorAction(
  supabase: SupabaseClient,
  input: {
    actionType:
      | "update_conversation_status"
      | "assign_conversation"
      | "link_conversation_record"
      | "create_task"
      | "update_task"
      | "delete_task"
      | "update_next_action"
      | "transition_opportunity"
      | "update_opportunity_details"
      | "create_opportunity"
      | "update_opportunity_record"
      | "update_opportunity_intake"
      | "reorder_opportunities";
    title: string;
    payload: Record<string, unknown>;
    actorEmail: string;
    dedupeKey?: string;
  },
) {
  const action = await proposeAction(supabase, {
    actionType: input.actionType,
    title: input.title,
    payload: input.payload,
    proposedBy: input.actorEmail,
    sourceContext: "operator_ui",
    dedupeKey: input.dedupeKey,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  return approveAndExecuteAction(supabase, String(action.id), input.actorEmail);
}

/** Deterministic jobs and approved batches reuse the same atomic task writer.
 * Their authority is retained as system/parent provenance, never human approval. */
export async function executeTaskCreation(database: SupabaseClient, input: RevenueTaskInput) {
  const { execution, actorEmail, ...payload } = input;
  const systemSource = systemSourceForDatabase(database);
  if (!execution && !systemSource) {
    return runOperatorAction(database, {
      actionType: "create_task",
      title: input.title,
      payload,
      actorEmail,
    });
  }
  const { data, error } = await database.rpc("create_revenue_task", {
    p_input: payload,
    p_actor: actorEmail,
    p_parent_action: execution?.actionId ?? null,
    p_parent_payload: execution?.payload ?? null,
    p_system_source: systemSource ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Existing pipeline callers retain their actor or bound deterministic provenance. */
export async function executePipelineChange(
  database: SupabaseClient,
  actionType:
    | "transition_opportunity"
    | "update_opportunity_details"
    | "create_opportunity"
    | "update_opportunity_record"
    | "update_opportunity_intake"
    | "reorder_opportunities",
  actorEmail: string,
  payload: Record<string, unknown>,
) {
  const systemSource = systemSourceForDatabase(database);
  if (!systemSource)
    return runOperatorAction(database, {
      actionType,
      title: {
        transition_opportunity: "Change opportunity stage",
        update_opportunity_details: "Update opportunity details",
        create_opportunity: "Create opportunity",
        update_opportunity_record: "Update opportunity fields",
        update_opportunity_intake: "Update opportunity intake and identity",
        reorder_opportunities: "Reorder opportunities",
      }[actionType],
      payload,
      actorEmail,
    });
  let data: unknown;
  if (actionType === "reorder_opportunities") {
    const result = await database
      .from("opportunities")
      .select("*")
      .in(
        "id",
        (payload.updates as { id: string }[]).map((item) => item.id),
      )
      .order("id");
    if (result.error) throw new Error(result.error.message);
    data = result.data;
  } else if (actionType !== "create_opportunity") {
    const result = await database
      .from("opportunities")
      .select("*")
      .eq("id", payload.opportunityId)
      .maybeSingle();
    if (result.error || !result.data)
      throw new Error(result.error?.message ?? "Opportunity not found");
    data = result.data;
  }
  let expectedPipeline;
  if (["transition_opportunity", "reorder_opportunities"].includes(actionType)) {
    const columns = await database
      .from("kanban_columns")
      .select("column_key,label,metadata")
      .eq("board_key", "pipeline")
      .order("column_key");
    if (columns.error) throw new Error(columns.error.message);
    expectedPipeline = columns.data ?? [];
  }
  return applyPipelineEffect(
    database,
    actionType,
    { ...payload, expectedState: data, ...(expectedPipeline ? { expectedPipeline } : {}) },
    actorEmail,
    null,
  );
}
