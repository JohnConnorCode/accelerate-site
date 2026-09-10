import { getModuleSettings, type ModuleSettingsConfig } from "@/lib/revenue-os/modules";
import { z } from "zod";
import type { DemoScenarioPack } from "./scenarios";
import type { DemoBusinessState } from "./business-runtime";
import {
  collectionCasePatchSchema,
  type CollectionCaseView,
} from "@/lib/revenue-os/collection-contract";
import { renderCollectionReminder } from "@/lib/revenue-os/collection-reminder-template";
const now = () => new Date().toISOString();
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const response = (body: unknown, status = 200) => Response.json(body, { status });
async function digest(value: unknown) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function seedDemoCollections(pack: DemoScenarioPack, state: DemoBusinessState) {
  if (state.collections) return state.collections;
  state.collections = Array.from({ length: 6 }, (_, i) => {
    const person = pack.people[i]!,
      id = `00000000-0000-4000-8500-${String(i + 1).padStart(12, "0")}`,
      actionId = `00000000-0000-4000-8600-${String(i + 1).padStart(12, "0")}`,
      invoiceId = `in_collectiondemo${i + 1}`;
    const currency = i === 4 ? "eur" : "usd";
    const total = 10000 + i * 2500,
      remaining = i === 5 ? 0 : i === 1 ? 7500 : total,
      status = i === 5 ? "paid" : "open";
    state.invoices.push({
      actionId,
      receipt: {
        invoiceId,
        status,
        currency,
        amountDue: total,
        amountPaid: total - remaining,
        amountRemaining: remaining,
        customerEmail: person.email,
        testMode: true,
        hostedInvoiceUrl: null,
        providerRequestId: null,
        delivery: "not_requested",
        complete: true,
      },
      document: {
        number: `DEMO-COL-${i + 1}`,
        customerName: person.name,
        customerEmail: person.email,
        currency,
        lines: [{ description: pack.business.invoiceMemo, amount: total }],
        total,
        amountPaid: total - remaining,
        amountRemaining: remaining,
        status,
        dueLabel: day(-20 - i),
        paymentUrl: null,
      },
    });
    state.actions.push({
      id: actionId,
      action_type: "create_stripe_invoice_draft",
      title: `Collections invoice: ${person.name}`,
      description: "Simulated collection source invoice",
      status: "executed",
      error: null,
      payload: { contactId: person.id },
      result: { ...state.invoices[state.invoices.length - 1]!.receipt },
      pluginId: "stripe-invoicing",
      created_at: now(),
    });
    return {
      id,
      contactId: person.id,
      name: person.name,
      email: person.email,
      currency,
      status: i === 5 ? "settled" : "open",
      revision: 1,
      disputed: i === 2,
      paused: false,
      pauseUntil: null,
      promiseDate: i === 3 ? day(3) : i === 4 ? day(-2) : null,
      ownerEmail: i === 3 ? pack.tenant.founder.email : null,
      nextAction:
        i === 2
          ? "Resolve the billing dispute"
          : i === 3
            ? "Recheck after the payment promise"
            : i === 5
              ? "Verified payment settled this case"
              : "Review overdue invoices",
      invoices: [
        {
          creationActionId: actionId,
          invoiceId,
          remaining,
          status,
          dueDate: day(-20 - i),
          observedAt: now(),
        },
      ],
      work: [
        {
          id: crypto.randomUUID(),
          status: i === 2 || i === 5 ? "cancelled" : "pending",
          objective: "Review collection case",
          nextCheckAt: i === 3 ? `${day(4)}T00:00:00.000Z` : now(),
          reason:
            i === 3 ? "Recheck after the payment promise" : "Review verified overdue invoice facts",
        },
      ],
      events: [{ id: crypto.randomUUID(), kind: i === 5 ? "settled" : "observed", at: now() }],
      actions: [],
    };
  });
  return state.collections;
}
/** Shared demo engine adapter only. It uses the same workspace, schemas and
 * reminder renderer; all writes and provider outcomes remain fictional/session-owned. */
export async function handleDemoCollections(
  pack: DemoScenarioPack,
  state: DemoBusinessState,
  modules: Record<string, boolean>,
  url: URL,
  method: string,
  body: Record<string, unknown>,
  save: () => void,
  moduleSettings: ModuleSettingsConfig = {},
): Promise<Response | null> {
  const action = state.actions.find(
    (a) => a.id === body.id && a.pluginId === "receivables-collections",
  );
  if (
    !url.pathname.startsWith("/api/admin/collections") &&
    !(url.pathname === "/api/admin/revenue-os/actions" && action)
  )
    return null;
  const cooldownHours = z
    .number()
    .int()
    .min(1)
    .max(720)
    .parse(getModuleSettings("receivables-collections", moduleSettings).cooldownHours);
  const initialized = Boolean(state.collections);
  const cases = seedDemoCollections(pack, state);
  if (!initialized) save();
  const enabled = () => {
    if (!modules["receivables-collections"] || !modules["stripe-invoicing"])
      throw new Error("Collections or Stripe invoicing is disabled");
  };
  const find = (id: unknown) => {
    const item = cases.find((c) => c.id === id);
    if (!item) throw new Error("Case unavailable");
    return item;
  };
  const record = (c: CollectionCaseView, kind: string) => {
    c.events.unshift({ id: crypto.randomUUID(), kind, at: now() });
    state.receipts.unshift({
      id: crypto.randomUUID(),
      operation: kind,
      at: now(),
      simulated: true,
    });
    save();
  };
  const sync = (c: CollectionCaseView) => {
    for (const i of c.invoices) {
      const source = state.invoices.find((v) => v.actionId === i.creationActionId)!;
      i.remaining = source.receipt.amountRemaining;
      i.status = source.receipt.status;
      i.observedAt = now();
    }
    if (c.invoices.every((i) => i.status === "paid" && i.remaining === 0)) {
      c.status = "settled";
      c.nextAction = "Verified payment settled this case";
      for (const w of c.work) w.status = "cancelled";
    }
    c.revision++;
  };
  const preview = async (c: CollectionCaseView) => {
    enabled();
    if (
      c.status !== "open" ||
      c.disputed ||
      c.paused ||
      (c.pauseUntil && c.pauseUntil >= day(0)) ||
      c.promiseDate
    )
      throw new Error("Case is settled, held or awaiting promise review");
    if (
      state.actions.some(
        (a) =>
          a.pluginId === "receivables-collections" &&
          a.payload.caseId === c.id &&
          a.status === "executed" &&
          typeof a.result?.sent_at === "string" &&
          Date.parse(a.result.sent_at) > Date.now() - cooldownHours * 3600000,
      )
    )
      throw new Error("Reminder cooldown has not elapsed");
    const invoices = c.invoices
      .map((i) => {
        const source = state.invoices.find((v) => v.actionId === i.creationActionId)!;
        return {
          ...i,
          remaining: source.receipt.amountRemaining,
          status: source.receipt.status,
          url: "#simulated-payment",
        };
      })
      .filter((i) => i.status === "open" && i.remaining > 0 && i.dueDate && i.dueDate < day(0));
    if (!invoices.length) throw new Error("No eligible overdue balance remains");
    const content = renderCollectionReminder(
      { ...state.brand, logoUrl: "" },
      c.currency,
      invoices,
      true,
    );
    const value = {
      caseId: c.id,
      revision: c.revision,
      to: c.email,
      ...content,
      invoices,
      brandRevision: state.brandRevision,
      cooldownHours,
      simulated: true,
    };
    return { ...value, digest: await digest(value) };
  };
  try {
    if (url.pathname === "/api/admin/collections/workspace" && method === "GET") {
      enabled();
      const contact = url.searchParams.get("contactId");
      return response({
        cases: cases
          .filter((c) => !contact || c.contactId === contact)
          .map((c) => ({
            ...c,
            actions: state.actions
              .filter((a) => a.pluginId === "receivables-collections" && a.payload.caseId === c.id)
              .map((a) => ({ ...a, preview: a.payload.preview })),
          })),
        invoiceOptions: state.actions
          .filter((a) => a.action_type === "create_stripe_invoice_draft" && a.status === "executed")
          .map((a) => ({ id: a.id, title: a.title })),
        truncated: false,
        simulated: true,
      });
    }
    if (url.pathname === "/api/admin/collections" && method === "PATCH") {
      enabled();
      const c = find(body.caseId);
      if (c.revision !== body.revision || c.status !== "open")
        throw new Error("Case changed; reload before editing");
      const patch = collectionCasePatchSchema.parse(body.patch);
      Object.assign(c, patch);
      c.revision++;
      for (const w of c.work) {
        w.status = c.disputed || c.paused ? "cancelled" : "pending";
        w.objective = c.nextAction;
        w.nextCheckAt = c.promiseDate
          ? new Date(Date.parse(c.promiseDate) + 86400000).toISOString()
          : now();
        w.reason = c.promiseDate
          ? "Recheck after the payment promise"
          : "Review current collection policy";
      }
      record(c, "policy_updated");
      return response({ case: c, simulated: true });
    }
    if (url.pathname === "/api/admin/collections" && method === "POST") {
      enabled();
      const ids = z.array(z.uuid()).min(1).max(25).parse(body.creationActionIds);
      const matching = cases.filter((c) =>
        c.invoices.some((i) => ids.includes(i.creationActionId)),
      );
      if (ids.some((id) => !state.invoices.some((invoice) => invoice.actionId === id)))
        throw new Error("Invoice operation unavailable");
      for (const c of matching) {
        sync(c);
        record(c, "observed");
      }
      return response({ caseIds: matching.map((c) => c.id), simulated: true });
    }
    if (url.pathname === "/api/admin/collections/simulate-payment" && method === "POST") {
      enabled();
      const c = find(body.caseId);
      for (const i of c.invoices) {
        const source = state.invoices.find((v) => v.actionId === i.creationActionId)!;
        source.receipt.status = "paid";
        source.receipt.amountRemaining = 0;
        source.receipt.amountPaid = source.receipt.amountDue;
        source.document.status = "paid";
        source.document.amountRemaining = 0;
        source.document.amountPaid = source.document.total;
      }
      sync(c);
      record(c, "settled");
      return response({ simulated: true });
    }
    if (url.pathname === "/api/admin/collections/reminders" && method === "POST") {
      const c = find(body.caseId),
        current = await preview(c);
      if (!body.digest) return response({ preview: current });
      if (body.digest !== current.digest) throw new Error("Reminder changed; review again");
      let queued = state.actions.find(
        (a) =>
          a.pluginId === "receivables-collections" &&
          a.digest === current.digest &&
          a.status === "pending",
      );
      if (!queued) {
        queued = {
          id: crypto.randomUUID(),
          action_type: "send_collection_reminder",
          title: current.subject,
          description: "Simulated reminder; human approval required",
          status: "pending",
          error: null,
          payload: { caseId: c.id, preview: current },
          result: null,
          pluginId: "receivables-collections",
          created_at: now(),
          digest: current.digest,
        };
        state.actions.unshift(queued);
        record(c, "reminder_proposed");
      }
      return response({ action: queued, simulated: true });
    }
    if (action && method === "PATCH") {
      if (body.decision === "reconcile") {
        if (!action.result) throw new Error("No dispatch receipt exists");
        return response({ result: action.result, simulated: true });
      }
      if (action.status !== "pending") throw new Error("Action already handled");
      const c = find(action.payload.caseId);
      if (body.decision === "reject") {
        action.status = "rejected";
        record(c, "reminder_rejected");
        return response({ simulated: true });
      }
      if (body.decision !== "approve") throw new Error("Invalid decision");
      try {
        const current = await preview(c);
        if (current.digest !== action.digest) throw new Error("Reminder facts changed");
        action.status = "executed";
        action.result = {
          state: "sent",
          provider_id: "simulated-" + action.id,
          sent_at: now(),
          simulated: true,
        };
        for (const w of c.work) {
          w.nextCheckAt = new Date(Date.now() + cooldownHours * 3600000).toISOString();
          w.reason = "Recheck after the confirmed reminder cooldown";
        }
        record(c, "reminder_sent");
        return response({ result: action.result, simulated: true });
      } catch {
        action.status = "failed";
        action.error = "Reminder skipped: payment, policy, recipient or plugin state changed.";
        action.result = { status: "skipped", simulated: true };
        record(c, "reminder_skipped");
        return response({ error: action.error, simulated: true }, 409);
      }
    }
    return response({ error: "Unsupported Collections demo operation" }, 404);
  } catch (error) {
    console.warn("[demo-collections] Operation refused");
    return response(
      {
        error: error instanceof Error ? error.message : "Collections operation refused",
        simulated: true,
      },
      409,
    );
  }
}
