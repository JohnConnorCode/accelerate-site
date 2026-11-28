import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callCollectionHostRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { isModuleEnabled } from "./modules";
import { decryptTenantSecret } from "./encryption";
import { invoicePath } from "@/lib/invoices/schema";

import { collectionCasePatchSchema } from "./collection-contract";
export { collectionCasePatchSchema } from "./collection-contract";
const observationSchema = z
  .object({
    invoiceId: z.uuid(),
    number: z.string().min(1).max(40),
    contactId: z.uuid(),
    testMode: z.boolean(),
    currency: z.literal("usd"),
    status: z.enum(["open", "processing", "paid", "paid_external", "void"]),
    remaining: z.number().int().min(0).max(100_000_000),
    dueDate: z.iso.date().nullable(),
    observedAt: z.iso.datetime(),
    paymentUrl: z.url().nullable(),
    complete: z.literal(true),
  })
  .strict()
  .refine(
    (o) => !["paid", "paid_external", "void"].includes(o.status) || o.remaining === 0,
    "Closed invoice has an inconsistent balance",
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
/** Current facts for one of this workspace's issued invoices, read from our own
 * invoices table. The payment link is our own customer invoice page. */
export async function observeInvoice(
  db: SupabaseClient,
  invoiceId: string,
  observedAt: string,
): Promise<CollectionObservation> {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Collections requires a tenant-bound host");
  const { data: row, error } = await db
    .from("invoices")
    .select(
      "id,tenant_id,number,contact_id,livemode,currency,status,amount_cents,amount_paid_cents,due_at,encrypted_link_token",
    )
    .eq("tenant_id", tenantId)
    .eq("id", z.uuid().parse(invoiceId))
    .maybeSingle();
  if (error || !row) throw new Error("Invoice is unavailable");
  if (!row.contact_id || !row.number || row.status === "draft")
    throw new Error("Collections tracks issued invoices linked to a contact");
  const { data: tenant } = await db.from("tenants").select("slug").eq("id", tenantId).maybeSingle();
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  const token =
    row.status !== "void" && row.encrypted_link_token
      ? decryptTenantSecret(row.encrypted_link_token, tenantId, "invoices", "link_token")
      : null;
  const closed = ["paid", "paid_external", "void"].includes(row.status);
  return observationSchema.parse({
    invoiceId: row.id,
    number: row.number,
    contactId: row.contact_id,
    testMode: row.livemode === false,
    currency: row.currency,
    status: row.status,
    remaining: closed ? 0 : Number(row.amount_cents) - Number(row.amount_paid_cents),
    dueDate: row.due_at ? String(row.due_at).slice(0, 10) : null,
    observedAt,
    paymentUrl:
      token && tenant?.slug && site
        ? new URL(invoicePath(tenant.slug, token), site).toString()
        : null,
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
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate invoice");
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
  // Validates each invoice is issued and linked; the RPC re-reads balances itself.
  await Promise.all(ids.map((id) => observeInvoice(db, id, observedAt)));
  await requireCollections(db);
  const { data, error } = await callCollectionHostRpc(db, "sync_collection_observations", {
    p_request: requestId,
    p_observations: ids.map((invoiceId) => ({ invoiceId })),
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
