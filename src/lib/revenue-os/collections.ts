import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callCollectionHostRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { isModuleEnabled } from "./modules";
import { readStripeInvoiceForAction } from "./stripe-invoicing";

import { collectionCasePatchSchema } from "./collection-contract";
export { collectionCasePatchSchema } from "./collection-contract";
const observationSchema = z
  .object({
    creationActionId: z.uuid(),
    contactId: z.uuid(),
    credentialVersion: z.number().int().positive(),
    providerAccount: z.string().regex(/^acct_[A-Za-z0-9]+$/),
    invoiceId: z.string().regex(/^in_[A-Za-z0-9]+$/),
    testMode: z.boolean(),
    currency: z.enum(["usd", "eur", "gbp", "cad", "aud"]),
    status: z.enum(["draft", "open", "paid", "void", "uncollectible"]),
    remaining: z.number().int().min(0).max(100_000_000),
    dueDate: z.iso.date().nullable(),
    observedAt: z.iso.datetime(),
    providerRequestId: z.string().max(200).nullable(),
    complete: z.literal(true),
  })
  .strict()
  .refine(
    (o) => o.status !== "paid" || o.remaining === 0,
    "Paid invoice has an inconsistent balance",
  );
export type CollectionObservation = z.infer<typeof observationSchema>;
export async function requireCollections(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Collections requires a tenant-bound host");
  const { data, error } = await db
    .from("tenants")
    .select("status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (
    error ||
    data?.status !== "active" ||
    !isModuleEnabled("receivables-collections", data.config)
  )
    throw new Error("Collections is disabled or workspace unavailable");
  return tenantId;
}
/** Projection of an invoice already fetched and ownership-checked by the
 * canonical Stripe service. This is not a client billing-input contract. */
export function projectCollectionObservation(
  verified: Awaited<ReturnType<typeof readStripeInvoiceForAction>>,
  observedAt: string,
): CollectionObservation {
  const { client, creation, invoice, receipt } = verified;
  if (creation.status !== "executed" || !receipt.complete)
    throw new Error("Invoice creation has no complete execution receipt");
  const contactId = z.uuid().parse(creation.payload?.contactId);
  const metadata = invoice.metadata as Record<string, unknown> | undefined;
  if (
    metadata?.accelerate_contact_id !== contactId ||
    metadata?.accelerate_tenant_id !== client.tenantId ||
    metadata?.accelerate_action_id !== creation.id ||
    receipt.testMode !== (client.mode === "test") ||
    receipt.currency !== creation.payload?.currency ||
    invoice.customer !== creation.payload?.customerId
  )
    throw new Error("Invoice billing identity changed; reconcile before collection");
  const due = invoice.due_date;
  if (due !== null && (!Number.isSafeInteger(due) || Number(due) < 0))
    throw new Error("Invoice due date is unavailable");
  const dueDate = due === null ? null : new Date(Number(due) * 1000).toISOString().slice(0, 10);
  return observationSchema.parse({
    creationActionId: creation.id,
    contactId,
    providerAccount: client.accountId,
    credentialVersion: client.credentialVersion,
    invoiceId: receipt.invoiceId,
    testMode: receipt.testMode,
    currency: receipt.currency,
    status: receipt.status,
    remaining: receipt.amountRemaining,
    dueDate,
    observedAt,
    providerRequestId: receipt.providerRequestId,
    complete: true,
  });
}
/** Refresh explicitly tracked platform invoices. Missing invoices are never
 * interpreted as paid. Any provider/identity failure prevents the whole write. */
export async function syncCollectionCases(
  db: SupabaseClient,
  rawIds: unknown,
  requestId: string,
  actorEmail: string,
) {
  const ids = z.array(z.uuid()).min(1).max(25).parse(rawIds).sort();
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate invoice operation");
  z.uuid().parse(requestId);
  z.email().parse(actorEmail);
  const tenantId = await requireCollections(db);
  const hash = createHash("sha256")
    .update("observe:" + ids.join(","))
    .digest("hex");
  const { data: prior, error: priorError } = await db
    .from("collection_commands")
    .select("command_hash,result")
    .eq("tenant_id", tenantId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (priorError) throw new Error("Collection command history is unavailable");
  if (prior) {
    if (prior.command_hash !== hash) throw new Error("Request identity conflict");
    return prior.result;
  }
  const observedAt = new Date().toISOString();
  const observations = await Promise.all(
    ids.map(async (id) =>
      projectCollectionObservation(await readStripeInvoiceForAction(db, id), observedAt),
    ),
  );
  await requireCollections(db);
  const { data, error } = await callCollectionHostRpc(db, "sync_collection_observations", {
    p_request: requestId,
    p_observations: observations,
    p_actor: actorEmail,
  });
  if (error)
    throw new Error(
      "Collection refresh was not recorded; retry the same request after checking current case and connection state",
    );
  return data;
}
export async function updateCollectionCase(
  db: SupabaseClient,
  caseId: string,
  revision: number,
  requestId: string,
  rawPatch: unknown,
  actorEmail: string,
) {
  z.uuid().parse(caseId);
  z.number().int().positive().parse(revision);
  z.uuid().parse(requestId);
  z.email().parse(actorEmail);
  const patch = collectionCasePatchSchema.parse(rawPatch);
  await requireCollections(db);
  const { data, error } = await callCollectionHostRpc(db, "update_collection_case", {
    p_case: caseId,
    p_revision: revision,
    p_request: requestId,
    p_patch: patch,
    p_actor: actorEmail,
  });
  if (error) throw new Error("Case changed or is unavailable. Reload before retrying your edit.");
  return data;
}
export async function listCollectionCases(db: SupabaseClient, status: "open" | "settled" = "open") {
  z.enum(["open", "settled"]).parse(status);
  const tenantId = await requireCollections(db);
  const { data, error } = await db
    .from("collection_cases")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Collections cases are unavailable");
  return data ?? [];
}
