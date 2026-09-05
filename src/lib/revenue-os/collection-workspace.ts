import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireCollections } from "./collections";
import type { CollectionWorkspaceData } from "./collection-contract";
/** Bounded canonical case/evidence/work read. Page reads never call providers. */
export async function readCollectionWorkspace(
  db: SupabaseClient,
  contactId?: string,
): Promise<CollectionWorkspaceData> {
  if (contactId) z.uuid().parse(contactId);
  const tenant = await requireCollections(db);
  let query = db
    .from("collection_cases")
    .select("*")
    .eq("tenant_id", tenant)
    .order("updated_at", { ascending: false })
    .limit(101);
  if (contactId) query = query.eq("contact_id", contactId);
  const result = await query;
  if (result.error) throw new Error("Collection cases unavailable");
  const cases = (result.data ?? []).slice(0, 100),
    ids = cases.map((c) => c.id),
    contacts = [...new Set(cases.map((c) => c.contact_id))];
  const options = await db
    .from("action_queue")
    .select("id,title")
    .eq("tenant_id", tenant)
    .eq("action_type", "create_stripe_invoice_draft")
    .eq("status", "executed")
    .order("created_at", { ascending: false })
    .limit(50);
  if (options.error) throw new Error("Invoice operations unavailable");
  if (!ids.length) return { cases: [], invoiceOptions: options.data ?? [], truncated: false };
  const [people, work, events, actions, attempts] = await Promise.all([
    db
      .from("contacts")
      .select("id,full_name,primary_email")
      .eq("tenant_id", tenant)
      .in("id", contacts),
    db
      .from("work_items")
      .select("id,entity_id,status,objective,next_check_at,next_check_reason")
      .eq("tenant_id", tenant)
      .eq("kind", "review_collection_case")
      .in("entity_id", ids)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("collection_events")
      .select("id,case_id,kind,created_at")
      .eq("tenant_id", tenant)
      .in("case_id", ids)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("action_queue")
      .select("id,entity_id,title,status,error,result,payload")
      .eq("tenant_id", tenant)
      .eq("action_type", "send_collection_reminder")
      .in("entity_id", ids)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("collection_reminder_attempts")
      .select("action_id,state,provider_id,sent_at")
      .eq("tenant_id", tenant)
      .in("case_id", ids)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (attempts.error || people.error || work.error || events.error || actions.error)
    throw new Error("Collection history unavailable");
  const refs: { case_id: string; creation_action_id: string; observation_id: string }[] = [];
  for (let offset = 0; offset <= 2500; offset += 500) {
    const page = await db
      .from("collection_case_invoices")
      .select("case_id,creation_action_id,observation_id")
      .eq("tenant_id", tenant)
      .in("case_id", ids)
      .order("case_id")
      .order("creation_action_id")
      .range(offset, offset + 499);
    if (page.error) throw new Error("Invoice references unavailable");
    refs.push(...(page.data ?? []));
    if ((page.data ?? []).length < 500) break;
  }
  if (refs.length > 2500) throw new Error("Filter by customer to load a complete bounded case set");
  const observationIds = [...new Set(refs.map((r) => r.observation_id))];
  const observations: {
    id: string;
    invoice_id: string;
    remaining: number;
    status: string;
    due_date: string | null;
    observed_at: string;
  }[] = [];
  for (let offset = 0; offset < observationIds.length; offset += 100) {
    const page = await db
      .from("collection_observations")
      .select("id,invoice_id,remaining,status,due_date,observed_at")
      .eq("tenant_id", tenant)
      .in("id", observationIds.slice(offset, offset + 100));
    if (page.error) throw new Error("Invoice evidence unavailable");
    observations.push(...(page.data ?? []));
  }
  if (observations.length !== observationIds.length) throw new Error("Incomplete invoice evidence");
  const byId = new Map(observations.map((o) => [o.id, o]));
  return {
    truncated:
      (result.data?.length ?? 0) > 100 ||
      (work.data?.length ?? 0) === 500 ||
      (events.data?.length ?? 0) === 500 ||
      (actions.data?.length ?? 0) === 500,
    invoiceOptions: options.data ?? [],
    cases: cases.map((c) => {
      const person = people.data?.find((p) => p.id === c.contact_id);
      return {
        id: c.id,
        contactId: c.contact_id,
        name: person?.full_name ?? "Billing contact",
        email: person?.primary_email ?? "",
        currency: c.currency,
        status: c.status,
        revision: c.revision,
        disputed: c.disputed,
        paused: c.paused,
        pauseUntil: c.pause_until,
        promiseDate: c.promise_date,
        ownerEmail: c.owner_email,
        nextAction: c.next_action,
        invoices: refs
          .filter((r) => r.case_id === c.id)
          .map((r) => {
            const o = byId.get(r.observation_id)!;
            return {
              creationActionId: r.creation_action_id,
              invoiceId: o.invoice_id,
              remaining: Number(o.remaining),
              status: o.status,
              dueDate: o.due_date,
              observedAt: o.observed_at,
            };
          }),
        work: (work.data ?? [])
          .filter((w) => w.entity_id === c.id)
          .map((w) => ({
            id: w.id,
            status: w.status,
            objective: w.objective,
            nextCheckAt: w.next_check_at,
            reason: w.next_check_reason,
          })),
        events: (events.data ?? [])
          .filter((e) => e.case_id === c.id)
          .map((e) => ({ id: e.id, kind: e.kind, at: e.created_at })),
        actions: (actions.data ?? [])
          .filter((a) => a.entity_id === c.id)
          .map((a) => ({
            id: a.id,
            title: a.title,
            status: a.status,
            error: a.error,
            result: attempts.data?.find((r) => r.action_id === a.id) ?? a.result,
            preview: a.payload?.preview
              ? { to: String(a.payload.preview.to), text: String(a.payload.preview.text) }
              : undefined,
          })),
      };
    }),
  };
}
