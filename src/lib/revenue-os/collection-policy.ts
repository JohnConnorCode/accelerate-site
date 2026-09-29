import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { assertCurrentTenantAdmin } from "./tenant-admin-authority";
import {
  requireCollections,
  updateCollectionCase,
  projectCollectionObservation,
} from "./collections";
import { readCollectionWorkspace } from "./collection-workspace";
import { readStripeInvoiceForAction } from "./stripe-invoicing";
import { proposeAction } from "./actions";
import {
  collectionPolicyPreviewSchema,
  collectionPolicyProposalSchema,
} from "./collection-agent-contract";

const hash = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
          : item,
      ),
    )
    .digest("hex");
const approvalSchema = collectionPolicyProposalSchema
  .extend({
    version: z.literal(1),
    tenantId: z.uuid(),
    revision: z.number().int().positive(),
    requestId: z.uuid(),
    before: z.record(z.string(), z.json()),
    after: z.record(z.string(), z.json()),
    facts: z.record(z.string(), z.json()),
  })
  .strict();

/** Read the same case as admin and bind approval to current provider facts.
 * The model may propose policy, never billing amounts, identity or payment links. */
export async function previewCollectionPolicy(db: SupabaseClient, raw: unknown) {
  const input = collectionPolicyPreviewSchema.parse(raw);
  const tenantId = await requireCollections(db);
  const view = await readCollectionWorkspace(db, undefined, {
    caseId: input.caseId,
    maxCases: 1,
    includeInvoiceOptions: false,
    includeActionPreviews: false,
  });
  const c = view.cases[0];
  if (!c || c.status !== "open") throw new Error("Open collection case is unavailable");
  if (!c.invoices.length || c.invoices.length > 25)
    throw new Error("Review cases with 1–25 tracked invoices; use Collections for larger cases");
  const invoices = await Promise.all(
    [...c.invoices]
      .sort((a, b) => a.creationActionId.localeCompare(b.creationActionId))
      .map(async (item) => {
        const verified = await readStripeInvoiceForAction(db, item.creationActionId);
        const observation = projectCollectionObservation(verified, new Date().toISOString());
        if (observation.contactId !== c.contactId || observation.currency !== c.currency)
          throw new Error("Collection billing identity changed; refresh the case");
        const {
          observedAt: _observedAt,
          providerRequestId: _providerRequestId,
          ...stable
        } = observation;
        return {
          ...stable,
          customerId: String(verified.invoice.customer),
          paymentUrl: verified.receipt.hostedInvoiceUrl ?? null,
        };
      }),
  );
  if (!invoices.some((i) => i.status === "open" && i.remaining > 0))
    throw new Error("No open balance remains; refresh the case before changing policy");
  const before = {
    disputed: c.disputed,
    paused: c.paused,
    pauseUntil: c.pauseUntil,
    promiseDate: c.promiseDate,
    ownerEmail: c.ownerEmail,
    nextAction: c.nextAction,
  };
  const after = { ...before, ...input.patch };
  const changes = (Object.keys(input.patch) as Array<keyof typeof before>)
    .filter((key) => before[key] !== after[key])
    .map((field) => ({ field, before: before[field], after: after[field] }));
  if (!changes.length) throw new Error("No collection policy values would change");
  const facts = {
    contactId: c.contactId,
    name: c.name,
    email: c.email,
    currency: c.currency,
    invoices,
  };
  const snapshot = {
    version: 1 as const,
    tenantId,
    caseId: c.id,
    revision: c.revision,
    patch: input.patch,
    before,
    after,
    facts,
  };
  return {
    ...snapshot,
    digest: hash(snapshot),
    changes,
    requiresHumanApproval: true,
    effect:
      "Updates this case and its follow-up work. Does not send a reminder or change an invoice.",
  };
}

export async function proposeCollectionPolicy(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = collectionPolicyProposalSchema.parse(raw);
  const preview = await previewCollectionPolicy(db, { caseId: input.caseId, patch: input.patch });
  if (preview.digest !== input.digest)
    throw new Error("Collection policy preview changed. Preview again before proposing.");
  const { changes, requiresHumanApproval: _approval, effect, ...snapshot } = preview;
  return proposeAction(db, {
    actionType: "update_collection_policy",
    title: `Update collection policy: ${preview.facts.name}`,
    description:
      changes
        .map((c) => `${c.field}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`)
        .join("\n") + `\n${effect}`,
    payload: { ...snapshot, requestId: randomUUID() },
    sourceContext: "admin_ai",
    entityType: "collection_case",
    entityId: preview.caseId,
    proposedBy: actorEmail,
    dedupeKey: `collection-policy:${preview.tenantId}:${preview.digest}`,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

export async function executeCollectionPolicy(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = approvalSchema.parse(raw);
  await assertCurrentTenantAdmin(db, actorEmail);
  await requireCollections(db);
  const { requestId, digest, ...snapshot } = input;
  if (input.tenantId !== tenantIdForDatabase(db) || hash(snapshot) !== digest)
    throw new Error("Collection approval does not match its workspace or exact preview");
  const prior = await db
    .from("collection_commands")
    .select("request_id")
    .eq("tenant_id", input.tenantId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (prior.error) throw new Error("Collection command history is unavailable");
  // A lost terminal action receipt can safely replay the already committed
  // command. The canonical RPC verifies the same request, case, revision and patch.
  if (!prior.data) {
    const current = await previewCollectionPolicy(db, { caseId: input.caseId, patch: input.patch });
    if (current.digest !== digest)
      throw new Error(
        "Collection policy, recipient or invoice facts changed. Preview and approve again.",
      );
  }
  return updateCollectionCase(db, input.caseId, input.revision, requestId, input.patch, actorEmail);
}
