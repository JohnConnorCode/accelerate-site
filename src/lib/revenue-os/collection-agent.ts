import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readCollectionWorkspace } from "./collection-workspace";
import { collectionSummary } from "./collection-contract";
import { previewCollectionReminder, proposeCollectionReminder } from "./collection-reminders";
import {
  collectionContextInputSchema,
  collectionPreviewInputSchema,
  collectionProposalInputSchema,
} from "./collection-agent-contract";

const MAX_RESULT_BYTES = 48_000;
function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_RESULT_BYTES)
    throw new Error(
      "Collections context exceeds its 48 KB limit. Request fewer cases or filter by caseId; review large reminders in the workspace.",
    );
  return value;
}
const text = (value: string | null | undefined, limit: number) => value?.slice(0, limit) ?? null;

/** Same canonical read as admin, narrowed before the database query. No provider reads. */
export async function readCollectionAgentContext(db: SupabaseClient, raw: unknown) {
  const input = collectionContextInputSchema.parse(raw);
  const maxCases = input.maxCases ?? 5;
  const view = await readCollectionWorkspace(db, input.contactId, {
    caseId: input.caseId,
    status: input.status,
    maxCases,
    includeInvoiceOptions: false,
    includeActionPreviews: false,
  });
  if (input.caseId && !view.cases.length)
    throw new Error("Collection case is unavailable in this workspace");
  const generatedAt = new Date().toISOString();
  const cases = view.cases.map((c) => {
    if (!c.invoices.length) throw new Error("Collection case has incomplete invoice evidence");
    for (const invoice of c.invoices) {
      z.number().int().min(0).max(100_000_000).parse(invoice.remaining);
      z.uuid().parse(invoice.observationId);
    }
    return {
      caseId: c.id,
      contactId: c.contactId,
      name: text(c.name, 120),
      currency: c.currency,
      status: c.status,
      revision: c.revision,
      policy: {
        disputed: c.disputed,
        paused: c.paused,
        pauseUntil: c.pauseUntil,
        promiseDate: c.promiseDate,
        ownerEmail: text(c.ownerEmail, 254),
      },
      nextAction: text(c.nextAction, 500),
      observedOpenBalanceMinorUnits: c.invoices
        .filter((i) => i.status === "open")
        .reduce((sum, i) => sum + i.remaining, 0),
      invoiceCount: c.invoices.length,
      invoices: c.invoices.slice(0, 25),
      invoicesTruncated: c.invoices.length > 25,
      work: c.work
        .slice(0, 3)
        .map((w) => ({ ...w, objective: text(w.objective, 500), reason: text(w.reason, 500) })),
      recentEvents: c.events.slice(0, 3),
      recentActions: c.actions.slice(0, 3).map((a) => ({ actionId: a.id, status: a.status })),
      historyTruncated: c.work.length > 3 || c.events.length > 3 || c.actions.length > 3,
    };
  });
  return bounded({
    contract: "collections.agent-context.v1",
    generatedAt,
    source:
      "Last recorded provider observations for the returned cases; not a live Stripe refresh or payment attribution.",
    maxCases,
    cases,
    summary: collectionSummary(view.cases, generatedAt),
    summaryScope:
      "Only the returned cases and their complete stored invoice references, grouped by currency.",
    truncated: view.truncated || cases.some((c) => c.invoicesTruncated || c.historyTruncated),
  });
}

/** Host-approved text and facts only; HTML, credentials and connection internals stay private. */
export async function previewCollectionAgentReminder(db: SupabaseClient, raw: unknown) {
  const { caseId } = collectionPreviewInputSchema.parse(raw);
  const preview = await previewCollectionReminder(db, caseId);
  return bounded({
    contract: "collections.reminder-preview.v1",
    caseId: preview.caseId,
    contactId: preview.contactId,
    revision: preview.revision,
    currency: preview.currency,
    amountRemaining: preview.amountRemaining,
    to: preview.to,
    from: preview.from,
    replyTo: preview.replyTo,
    subject: preview.subject,
    text: preview.text,
    invoices: preview.invoices.map((i) => ({
      creationActionId: i.creationActionId,
      invoiceId: i.invoiceId,
      remaining: i.remaining,
      dueDate: i.dueDate,
      url: i.url,
    })),
    digest: preview.digest,
    testMode: preview.testMode,
    cooldownHours: preview.cooldownHours,
    requiresHumanApproval: true,
  });
}

export async function proposeCollectionAgentReminder(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const { caseId, digest } = collectionProposalInputSchema.parse(raw);
  const action = await proposeCollectionReminder(db, caseId, digest, actorEmail);
  // The action's complete approved content remains in the operator review surface.
  return {
    id: action.id,
    action_type: action.action_type,
    status: action.status,
    entity_type: action.entity_type,
    entity_id: action.entity_id,
    work_item_id: action.work_item_id ?? null,
    expires_at: action.expires_at,
    requiresHumanApproval: true,
  };
}
