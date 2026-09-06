import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callCollectionHostRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { getTenantFromEmail, getTenantReplyToEmail } from "@/lib/email/resend";
import { evaluateCollectionsSnapshot } from "../../../plugins/receivables-collections/evaluate";
import { projectCollectionObservation } from "./collections";
import { readStripeInvoiceForAction } from "./stripe-invoicing";
import { renderCollectionReminder } from "./collection-reminder-template";
import { readWorkspaceBrand } from "./branding";
import { getModuleSettings, isModuleEnabled } from "./modules";
import { proposeAction, checkpointActionResult } from "./actions";
import { sendRecordedEmail } from "./communications";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const payloadSchema = z
  .object({
    caseId: z.uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    preview: z.record(z.string(), z.unknown()),
  })
  .strict();

/** Every preview reads current billing facts through the canonical provider host.
 * Neither an agent nor a browser can supply balances, recipients or payment URLs. */
export async function previewCollectionReminder(db: SupabaseClient, caseId: string) {
  z.uuid().parse(caseId);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("A tenant-bound Collections host is required");
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (
    tenantError ||
    tenant?.status !== "active" ||
    !isModuleEnabled("receivables-collections", tenant.config) ||
    !isModuleEnabled("stripe-invoicing", tenant.config)
  )
    throw new Error("Collections or Stripe invoicing is unavailable");
  const cooldownHours = z
    .number()
    .int()
    .min(1)
    .max(720)
    .parse(
      getModuleSettings("receivables-collections", tenant.config?.moduleSettings).cooldownHours,
    );
  const { data: item, error: caseError } = await db
    .from("collection_cases")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", caseId)
    .maybeSingle();
  if (caseError || !item || item.status !== "open")
    throw new Error("An open collection case is required");
  const { data: contact, error: contactError } = await db
    .from("contacts")
    .select("id,primary_email,communication_status")
    .eq("tenant_id", tenantId)
    .eq("id", item.contact_id)
    .maybeSingle();
  if (contactError || !contact || contact.communication_status !== "active")
    throw new Error("Recipient is unavailable or communication is suppressed");
  const to = z.email().max(254).parse(contact.primary_email).toLowerCase();
  const { data: refs, error: refsError } = await db
    .from("collection_case_invoices")
    .select("creation_action_id")
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId)
    .limit(26);
  if (refsError || !refs?.length || refs.length > 25)
    throw new Error("A complete case of up to 25 tracked invoices is required");
  const [pending, history] = await Promise.all([
    db
      .from("collection_reminder_attempts")
      .select("state")
      .eq("tenant_id", tenantId)
      .eq("case_id", caseId)
      .in("state", ["dispatching", "uncertain"])
      .limit(1),
    db
      .from("collection_reminder_attempts")
      .select("sent_at")
      .eq("tenant_id", tenantId)
      .eq("case_id", caseId)
      .eq("state", "sent")
      .order("sent_at", { ascending: false })
      .limit(1),
  ]);
  if (pending.error || history.error) throw new Error("Reminder history is unavailable");
  if (pending.data?.length) throw new Error("An earlier reminder needs receipt reconciliation");
  const verified = await Promise.all(
    refs.map((ref) => readStripeInvoiceForAction(db, ref.creation_action_id)),
  );
  const now = new Date().toISOString();
  const observations = verified.map((value) => projectCollectionObservation(value, now));
  if (observations.some((o) => o.contactId !== item.contact_id || o.currency !== item.currency))
    throw new Error("Case billing identity changed");
  const decision = await evaluateCollectionsSnapshot(tenantId, {
    version: 1,
    tenantId,
    asOf: now,
    observedAt: now,
    complete: true,
    cooldownHours,
    invoices: observations.map((o) => ({
      id: o.invoiceId,
      tenantId,
      accountId: o.contactId,
      currency: o.currency,
      status: o.status,
      amountRemaining: o.remaining,
      dueDate: o.dueDate,
      disputed: item.disputed,
      paused: item.paused,
      pauseUntil: item.pause_until,
    })),
    policies: [
      {
        accountId: item.contact_id,
        currency: item.currency,
        communicationSuppressed: false,
        promiseDate: item.promise_date,
        lastReminderAt: history.data?.[0]?.sent_at ?? null,
      },
    ],
  });
  const group = decision.plan.groups[0];
  if (!group || group.action !== "prepare_reminder")
    throw new Error(group?.reason ?? "No eligible overdue invoices remain");
  const invoices = observations
    .filter((o) => group.invoiceIds.includes(o.invoiceId))
    .map((o) => {
      const receipt = verified.find((v) => v.receipt.invoiceId === o.invoiceId)!.receipt;
      const url = new URL(z.url().parse(receipt.hostedInvoiceUrl));
      if (
        url.protocol !== "https:" ||
        url.hostname !== "invoice.stripe.com" ||
        url.username ||
        url.password
      )
        throw new Error("A verified Stripe payment page is required");
      return {
        creationActionId: o.creationActionId,
        invoiceId: o.invoiceId,
        remaining: o.remaining,
        dueDate: o.dueDate,
        url: url.toString(),
        providerAccount: o.providerAccount,
        credentialVersion: o.credentialVersion,
      };
    })
    .sort((a, b) => a.invoiceId.localeCompare(b.invoiceId));
  const { brand, revision: brandRevision } = await readWorkspaceBrand(db);
  const [from, replyTo] = await Promise.all([getTenantFromEmail(db), getTenantReplyToEmail(db)]);
  const testMode = verified[0]!.receipt.testMode;
  const { subject, text, html } = renderCollectionReminder(
    brand,
    item.currency,
    invoices,
    testMode,
  );
  const preview = {
    tenantId,
    caseId,
    revision: item.revision,
    contactId: item.contact_id,
    currency: item.currency,
    to,
    from,
    replyTo,
    subject,
    text,
    html,
    invoices,
    amountRemaining: group.amountRemaining,
    cooldownHours,
    brandRevision,
    testMode,
    decisionSourceHash: decision.receipt.sourceHash,
  };
  return { ...preview, digest: hash(preview) };
}

export async function proposeCollectionReminder(
  db: SupabaseClient,
  caseId: string,
  expectedDigest: string,
  actorEmail: string,
) {
  digestSchema.parse(expectedDigest);
  z.email().parse(actorEmail);
  const current = await previewCollectionReminder(db, caseId);
  if (current.digest !== expectedDigest)
    throw new Error("Reminder changed. Review the refreshed preview before proposing it.");
  return proposeAction(db, {
    actionType: "send_collection_reminder",
    title: current.subject,
    description: `${current.to} · ${current.invoices.length} verified invoices`,
    payload: { caseId, revision: current.revision, digest: current.digest, preview: current },
    sourceContext: "collections",
    entityType: "collection_case",
    entityId: caseId,
    proposedBy: actorEmail,
    dedupeKey: `collection-reminder:${caseId}:${current.digest}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    evidence: {
      caseRevision: current.revision,
      decisionSourceHash: current.decisionSourceHash,
      digest: current.digest,
    },
  });
}

/** Called only by the shared human-approved executor. Reservation is atomic per
 * case, and uncertain acceptance is retained until canonical message evidence exists. */
export async function executeCollectionReminder(
  db: SupabaseClient,
  actionId: string,
  actorEmail: string,
) {
  z.uuid().parse(actionId);
  z.email().parse(actorEmail);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Tenant context is required");
  const { data: action, error } = await db
    .from("action_queue")
    .select("status,action_type,payload,approved_by")
    .eq("tenant_id", tenantId)
    .eq("id", actionId)
    .maybeSingle();
  if (
    error ||
    action?.status !== "executing" ||
    action.action_type !== "send_collection_reminder" ||
    !action.approved_by
  )
    throw new Error("A claimed human-approved reminder is required");
  const payload = payloadSchema.parse(action.payload);
  const { data: prior, error: priorError } = await db
    .from("collection_reminder_attempts")
    .select("state")
    .eq("tenant_id", tenantId)
    .eq("action_id", actionId)
    .maybeSingle();
  if (priorError) throw new Error("Reminder dispatch history is unavailable");
  if (prior) {
    const receipt = await callCollectionHostRpc(db, "reconcile_collection_reminder", {
      p_action: actionId,
    });
    if (receipt.error || receipt.data?.state !== "sent")
      throw new Error(
        "Reminder acceptance is uncertain; reconcile the existing message before any further send",
      );
    return receipt.data;
  }
  let preview: Awaited<ReturnType<typeof previewCollectionReminder>>;
  try {
    preview = await previewCollectionReminder(db, payload.caseId);
    if (preview.digest !== payload.digest || preview.revision !== payload.revision)
      throw new Error("Approved reminder facts changed");
  } catch {
    await checkpointActionResult(db, actionId, {
      status: "skipped",
      reason:
        "Current billing, recipient, policy, branding or plugin state no longer matches approval",
    });
    throw new Error("Reminder skipped. Refresh the case and review a new preview.");
  }
  const reservation = await callCollectionHostRpc(db, "reserve_collection_reminder", {
    p_action: actionId,
  });
  if (
    reservation.error ||
    reservation.data?.state !== "dispatching" ||
    reservation.data?.reserved !== true
  ) {
    await checkpointActionResult(db, actionId, {
      status: "skipped",
      reason: "Dispatch reservation refused because case or reminder policy changed",
    });
    throw new Error(
      "Case changed or another reminder is already reserved; reload before continuing",
    );
  }
  try {
    await sendRecordedEmail(db, {
      to: preview.to,
      from: preview.from,
      replyTo: preview.replyTo,
      subject: preview.subject,
      text: preview.text,
      html: preview.html,
      contactId: preview.contactId,
      actorEmail,
      source: "admin",
      template: "collection-reminder-v1",
      idempotencyKey: `action:${actionId}`,
    });
  } catch {
    // Reconciliation can recover provider acceptance even if a later audit write failed.
    console.warn("[collections] Reminder dispatch requires receipt reconciliation");
  }
  const receipt = await callCollectionHostRpc(db, "reconcile_collection_reminder", {
    p_action: actionId,
  });
  if (receipt.error || receipt.data?.state !== "sent") {
    await checkpointActionResult(db, actionId, {
      status: "uncertain",
      reason: "No confirmed provider receipt; sending again is prohibited",
    });
    throw new Error(
      "Reminder acceptance is uncertain. Reconcile the existing message; do not send another reminder.",
    );
  }
  return receipt.data;
}

/** Receipt recovery is an observation, not new execution authority. It remains
 * available after approval expiry or module disable and can never send email. */
export async function reconcileCollectionReminder(db: SupabaseClient, actionId: string) {
  z.uuid().parse(actionId);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Tenant context is required");
  const { data: action, error } = await db
    .from("action_queue")
    .select("action_type")
    .eq("tenant_id", tenantId)
    .eq("id", actionId)
    .maybeSingle();
  if (error || action?.action_type !== "send_collection_reminder")
    throw new Error("Reminder action is unavailable");
  const receipt = await callCollectionHostRpc(db, "reconcile_collection_reminder", {
    p_action: actionId,
  });
  if (receipt.error) throw new Error("Reminder receipt could not be reconciled");
  return receipt.data;
}
