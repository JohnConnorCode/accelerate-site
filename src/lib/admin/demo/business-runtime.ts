import { workflowTaskSchema as taskSchema } from "@/lib/revenue-os/workflow-task-contract";
import { z } from "zod";
import type { DemoScenarioPack } from "./scenarios";
import {
  workspaceBrandSchema,
  resolveWorkspaceBrand,
  contrastRatio,
  type WorkspaceBrand,
} from "@/lib/revenue-os/branding-contract";
import {
  stripeInvoiceInputSchema,
  type StripeInvoiceReceipt,
} from "@/lib/revenue-os/stripe-contract";
import { invoiceDesignSchema, defaultInvoiceDesign } from "@/lib/revenue-os/invoice-page-contract";
import type { InvoiceDocumentData, InvoiceDesign } from "@/components/business/InvoiceDocument";
import { REVENUE_OS_MODULES } from "@/lib/revenue-os/modules";

export const DEMO_BUSINESS_MODULES = {
  "stripe-invoicing": true,
  "client-onboarding": true,
  "meeting-commitments": true,
};
type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assigneeUserId: string;
  personId: string;
  sourceId: string;
  status: string;
};
type Action = {
  id: string;
  action_type: string;
  title: string;
  description: string;
  status: string;
  error: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  pluginId: string;
  created_at: string;
  requestId?: string;
  digest?: string;
};
type Invoice = { actionId: string; receipt: StripeInvoiceReceipt; document: InvoiceDocumentData };
type Page = {
  id: string;
  creationActionId: string;
  token: string;
  revokedAt: string | null;
  expiresAt: string;
  brand: WorkspaceBrand;
  design: InvoiceDesign;
};
export type DemoBusinessState = {
  version: 1;
  brand: WorkspaceBrand;
  brandRevision: number;
  actions: Action[];
  invoices: Invoice[];
  tasks: Task[];
  pages: Page[];
  receipts: { id: string; operation: string; at: string; simulated: true }[];
};
const memberId = "00000000-0000-4000-8000-000000000079";
const now = () => new Date().toISOString();
const due = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const customerId = (id: string) => "cus_demo" + id.replaceAll("-", "");
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const revision = (state: DemoBusinessState) => state.brandRevision.toString(16).padStart(64, "0");
async function digest(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function createDemoBusinessState(pack: DemoScenarioPack): DemoBusinessState {
  const brand = resolveWorkspaceBrand({ brand: pack.tenant.brand }, pack.name);
  Object.assign(brand, {
    legalName: pack.name,
    supportEmail: pack.tenant.founder.email,
    logoMark: pack.name
      .split(" ")
      .slice(0, 2)
      .map((x) => x[0])
      .join(""),
    logoUrl: `https://${pack.tenant.brand.domain}/demo-logo.svg`,
    businessAddress: "100 Market Square\nSuite 200 · Fictional business address",
    font: pack.id === "alder-ridge-law" ? "serif" : "sans",
  });
  const state: DemoBusinessState = {
    version: 1,
    brand,
    brandRevision: 1,
    actions: [],
    invoices: [],
    tasks: [],
    pages: [],
    receipts: [],
  };
  for (const [index, status] of ["open", "paid", "draft"].entries()) {
    const contact = pack.people[index]!;
    const id = `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`;
    const lines = pack.business.invoiceLines.map((x) => ({ ...x }));
    const total = lines.reduce((n, x) => n + x.quantity * x.unitAmount, 0);
    const payload = {
      contactId: contact.id,
      customerId: customerId(contact.id),
      currency: "usd",
      daysUntilDue: 14,
      memo: pack.business.invoiceMemo,
      lines,
      total,
    };
    const receipt: StripeInvoiceReceipt = {
      invoiceId: `in_demo${index + 1}`,
      status: status!,
      currency: "usd",
      amountDue: total,
      amountPaid: status === "paid" ? total : 0,
      amountRemaining: status === "paid" ? 0 : total,
      customerEmail: contact.email,
      testMode: true,
      hostedInvoiceUrl: null,
      providerRequestId: null,
      delivery: "not_requested",
      complete: true,
    };
    state.actions.push({
      id,
      action_type: "create_stripe_invoice_draft",
      title: `Invoice: ${contact.name}`,
      description: "Simulated · " + pack.business.invoiceMemo,
      status: "executed",
      error: null,
      payload,
      result: { ...receipt },
      pluginId: "stripe-invoicing",
      created_at: now(),
    });
    state.invoices.push({
      actionId: id,
      receipt,
      document: {
        number: `DEMO-${1001 + index}`,
        customerName: contact.name,
        customerEmail: contact.email,
        currency: "usd",
        lines: lines.map((x) => ({
          description: x.description,
          amount: x.quantity * x.unitAmount,
        })),
        total,
        amountPaid: receipt.amountPaid,
        amountRemaining: receipt.amountRemaining,
        status: status!,
        dueLabel: due(index === 0 ? -5 : 14),
        paymentUrl: null,
      },
    });
  }
  const won = pack.opportunities.find((x) => x.stage === "won")!;
  for (const [index, pluginId] of ["client-onboarding", "meeting-commitments"].entries()) {
    const source = index === 0 ? won : pack.opportunities[1]!;
    const titles = index === 0 ? pack.business.onboarding : pack.business.commitments;
    const tasks = titles.slice(0, 2).map((title, i) => ({
      id: `demo-task-${pluginId}-${i}`,
      title,
      description: "Reviewed fictional delivery commitment",
      dueDate: due(i + 1),
      assigneeUserId: memberId,
      personId: source.personId,
      sourceId: source.id,
      status: i === 0 ? "completed" : "pending",
    }));
    state.tasks.push(...tasks);
    state.actions.push({
      id: `demo-action-${pluginId}`,
      action_type: "create_task_batch",
      title: `${index === 0 ? "Onboarding" : "Meeting follow-up"}: ${source.name}`,
      description: "Simulated · Assigned delivery tasks",
      status: "executed",
      error: null,
      payload: { [index === 0 ? "opportunityId" : "meetingId"]: source.id, tasks },
      result: { complete: true, tasks },
      pluginId: pluginId!,
      created_at: now(),
    });
  }
  return state;
}
export function demoTasksForGraph(state: DemoBusinessState) {
  return state.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    personId: t.personId,
    dueOffset: Math.ceil((Date.parse(t.dueDate) - Date.now()) / 86400000),
    priority: "normal",
    status: t.status,
  }));
}
/** One session-owned simulator behind the real admin pages. No provider or database handles. */
export async function handleDemoBusinessRequest(
  pack: DemoScenarioPack,
  state: DemoBusinessState,
  modules: Record<string, boolean>,
  url: URL,
  method: string,
  body: Record<string, unknown>,
  save: () => void,
): Promise<Response | null> {
  const path = url.pathname;
  const enabled = (id: string) => modules[id] ?? false;
  const requireEnabled = (id: string) => {
    if (!enabled(id))
      throw new Error("This plugin is disabled. Enable it from Plugins to continue.");
  };
  const record = (operation: string) => {
    state.receipts.unshift({ id: crypto.randomUUID(), operation, at: now(), simulated: true });
    state.receipts = state.receipts.slice(0, 100);
    save();
  };
  const invoice = (id: unknown) => {
    const item = state.invoices.find((x) => x.actionId === id);
    if (!item) throw new Error("Invoice is unavailable in this fictional workspace");
    return item;
  };
  const view = async (id: unknown, design: unknown) => {
    const item = invoice(id);
    const parsed = invoiceDesignSchema.parse(design);
    return {
      brand: state.brand,
      design: parsed,
      document: item.document,
      testMode: true,
      digest: await digest({
        brandRevision: state.brandRevision,
        document: item.document,
        design: parsed,
      }),
      simulated: true,
    };
  };
  const queue = (
    pluginId: string,
    type: string,
    title: string,
    payload: Record<string, unknown>,
    requestId?: string,
    hash?: string,
  ) => {
    const prior = requestId
      ? state.actions.find((x) => x.pluginId === pluginId && x.requestId === requestId)
      : null;
    if (prior) {
      if (prior.digest !== hash)
        throw new Error("This request was already used for a different review");
      return prior;
    }
    if (state.actions.length >= 100) throw new Error("Reset the demo to start a fresh session");
    const action: Action = {
      id: crypto.randomUUID(),
      action_type: type,
      title,
      description: "Simulated · Review before approving",
      status: "pending",
      error: null,
      payload,
      result: null,
      pluginId,
      created_at: now(),
      requestId,
      digest: hash,
    };
    state.actions.unshift(action);
    record("Proposed " + title);
    return action;
  };
  try {
    if (path === "/api/admin/tenant/branding") {
      if (method === "GET")
        return response({
          brand: state.brand,
          revision: revision(state),
          previewInvoice: state.invoices[0]?.document,
          simulated: true,
        });
      if (method !== "PUT") return response({ error: "Unsupported branding operation" }, 405);
      if (body.revision !== revision(state))
        throw new Error("Branding changed. Reload before saving.");
      const brand = workspaceBrandSchema.parse(body.brand);
      if (
        contrastRatio(brand.inkColor, "#ffffff") < 4.5 ||
        contrastRatio(brand.inkColor, brand.backgroundColor) < 4.5
      )
        throw new Error("Text needs a contrast ratio of at least 4.5");
      state.brand = brand;
      state.brandRevision++;
      record("Saved workspace branding");
      return response({
        brand,
        revision: revision(state),
        previewInvoice: state.invoices[0]?.document,
        simulated: true,
      });
    }
    if (path === "/api/admin/invoicing" && method === "GET") {
      if (url.searchParams.has("actionId")) {
        requireEnabled("stripe-invoicing");
        return response(invoice(url.searchParams.get("actionId")).receipt);
      }
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const contacts = pack.people.filter((x) => x.name.toLowerCase().includes(search));
      return response({
        simulated: true,
        testMode: true,
        truncated: false,
        contacts: contacts.map((x) => ({ id: x.id, full_name: x.name, primary_email: x.email })),
        customers: pack.people
          .filter(
            (x) => !url.searchParams.get("contactId") || x.id === url.searchParams.get("contactId"),
          )
          .map((x) => ({ id: customerId(x.id), name: x.name, email: x.email })),
        actions: state.actions.filter((x) => x.pluginId === "stripe-invoicing"),
        suggestedInput: { memo: pack.business.invoiceMemo, lines: pack.business.invoiceLines },
      });
    }
    if (path === "/api/admin/plugins/tasks" && method === "GET") {
      const id = url.searchParams.get("pluginId");
      if (!["client-onboarding", "meeting-commitments"].includes(id ?? ""))
        throw new Error("Unknown workflow");
      const records =
        id === "client-onboarding"
          ? pack.opportunities
              .filter((x) => x.stage === "won")
              .map((x) => ({ id: x.id, name: x.name }))
          : pack.opportunities
              .slice(0, 12)
              .filter((_, i) => i % 4 !== 0)
              .map((x) => ({ id: x.id, title: x.name, start_at: due(1) }));
      return response({
        records,
        members: [{ user_id: memberId, invited_email: pack.tenant.founder.email }],
        currentUserId: memberId,
        truncated: false,
        actions: state.actions.filter((x) => x.pluginId === id),
        taskStates: Object.fromEntries(state.tasks.map((x) => [x.id, x.status])),
        suggestedTasks:
          id === "client-onboarding" ? pack.business.onboarding : pack.business.commitments,
        simulated: true,
      });
    }
    if (path === "/api/admin/plugins/workflow" && method === "POST") {
      const id = String(body.pluginId);
      requireEnabled(id);
      let payload: Record<string, unknown>, title: string, type: string;
      if (id === "stripe-invoicing") {
        const input = stripeInvoiceInputSchema.parse(body.input);
        const contact = pack.people.find((x) => x.id === input.contactId);
        if (!contact || customerId(contact.id) !== input.customerId)
          throw new Error("Select matching fictional CRM and billing customers");
        payload = {
          ...input,
          total: input.lines.reduce((n, x) => n + x.quantity * x.unitAmount, 0),
        };
        title = `Invoice: ${contact.name}`;
        type = "create_stripe_invoice_draft";
      } else {
        if (!["client-onboarding", "meeting-commitments"].includes(id))
          throw new Error("Unknown workflow");
        const field = id === "client-onboarding" ? "opportunityId" : "meetingId";
        const input = z
          .object({ [field]: z.uuid(), tasks: z.array(taskSchema).min(1).max(10) })
          .strict()
          .parse(body.input);
        const source = pack.opportunities.find((x) => x.id === input[field]);
        if (!source || (id === "client-onboarding" && source.stage !== "won"))
          throw new Error("Select a current source record");
        const tasks = input.tasks as z.infer<typeof taskSchema>[];
        if (tasks.some((x) => x.assigneeUserId !== memberId))
          throw new Error("Choose an active workspace assignee");
        payload = { ...input };
        title = `${id === "client-onboarding" ? "Client onboarding" : "Meeting commitments"}: ${source.name}`;
        type = "create_task_batch";
      }
      const hash = await digest({ id, payload });
      if (body.mode === "preview")
        return response({
          pluginId: id,
          title,
          summary: "Simulated · Review the exact work before approval.",
          actionType: type,
          payload,
          digest: hash,
        });
      if (body.mode !== "propose" || body.digest !== hash)
        throw new Error("Preview and review the current inputs first");
      const requestId = z.uuid().parse(body.requestId);
      return response({
        action: queue(id, type, title, payload, requestId, hash),
        simulated: true,
      });
    }
    if (path === "/api/admin/invoicing" && method === "POST") {
      requireEnabled("stripe-invoicing");
      const item = invoice(body.creationActionId);
      if (!["draft", "open"].includes(item.receipt.status))
        throw new Error("Invoice is not ready to send");
      return response({
        action: queue(
          "stripe-invoicing",
          "send_stripe_invoice",
          "Send invoice: " + item.document.customerName,
          { creationActionId: item.actionId },
          "send:" + item.actionId,
          await digest(item.document),
        ),
        simulated: true,
      });
    }
    if (path === "/api/admin/invoicing/pages") {
      if (method === "GET") {
        if (url.searchParams.has("token")) {
          requireEnabled("stripe-invoicing");
          const p = state.pages.find(
            (x) =>
              x.token === url.searchParams.get("token") &&
              !x.revokedAt &&
              Date.parse(x.expiresAt) > Date.now(),
          );
          if (!p) throw new Error("This demo invoice link is unavailable or revoked");
          return response({
            brand: p.brand,
            design: p.design,
            document: invoice(p.creationActionId).document,
            simulated: true,
          });
        }
        return response({
          tenantSlug: pack.id,
          pages: state.pages.filter(
            (x) => x.creationActionId === url.searchParams.get("creationActionId"),
          ),
          simulated: true,
        });
      }
      requireEnabled("stripe-invoicing");
      if (body.mode === "revoke") {
        const p = state.pages.find((x) => x.id === body.pageId);
        if (!p) throw new Error("Page unavailable");
        if (!p.revokedAt) {
          p.revokedAt = now();
          record("Revoked demo invoice link");
        }
        return response({ simulated: true });
      }
      if (body.mode === "generate") {
        invoice(body.creationActionId);
        z.string().max(1000).parse(body.brief);
        record("Simulated AI invoice design");
        return response({
          design: {
            ...defaultInvoiceDesign,
            layout: String(body.brief).toLowerCase().includes("classic") ? "classic" : "editorial",
            introduction: pack.business.introduction,
            closing: `Questions? Contact ${state.brand.supportEmail}.`,
          },
          simulated: true,
        });
      }
      const preview = await view(body.creationActionId, body.design);
      if (body.mode === "preview") return response(preview);
      if (body.mode !== "propose" || body.digest !== preview.digest)
        throw new Error("Preview the current design and branding first");
      if (!["open", "paid"].includes(invoice(body.creationActionId).receipt.status))
        throw new Error("Finalize the invoice before publication");
      return response({
        action: queue(
          "stripe-invoicing",
          "publish_invoice_page",
          "Publish customer invoice",
          { creationActionId: body.creationActionId, design: preview.design },
          z.uuid().parse(body.requestId),
          preview.digest,
        ),
        simulated: true,
      });
    }
    if (path === "/api/admin/revenue-os/actions" && method === "PATCH") {
      const action = state.actions.find((x) => x.id === body.id);
      if (!action) return null;
      if (body.decision === "reject") {
        if (action.status !== "pending") throw new Error("Action already handled");
        action.status = "rejected";
        record("Rejected " + action.title);
        return response({ simulated: true });
      }
      if (body.decision === "retry") {
        if (action.status !== "failed") throw new Error("Only failed actions can retry");
        action.status = "pending";
        action.error = null;
        record("Retry staged for " + action.title);
        return response({ simulated: true });
      }
      if (body.decision !== "approve" || action.status !== "pending")
        throw new Error("Action already handled or invalid decision");
      try {
        requireEnabled(action.pluginId);
        if (action.action_type === "create_stripe_invoice_draft") {
          const p = action.payload as unknown as z.infer<typeof stripeInvoiceInputSchema>;
          const contact = pack.people.find((x) => x.id === p.contactId)!;
          const total = p.lines.reduce((n, x) => n + x.quantity * x.unitAmount, 0);
          const receipt: StripeInvoiceReceipt = {
            invoiceId: "in_demo" + action.id.replaceAll("-", ""),
            status: "draft",
            currency: p.currency,
            amountDue: total,
            amountPaid: 0,
            amountRemaining: total,
            customerEmail: contact.email,
            testMode: true,
            hostedInvoiceUrl: null,
            providerRequestId: null,
            delivery: "not_requested",
            complete: true,
          };
          state.invoices.unshift({
            actionId: action.id,
            receipt,
            document: {
              number: `DEMO-${1001 + state.invoices.length}`,
              customerName: contact.name,
              customerEmail: contact.email,
              currency: p.currency,
              lines: p.lines.map((x) => ({
                description: x.description,
                amount: x.quantity * x.unitAmount,
              })),
              total,
              amountPaid: 0,
              amountRemaining: total,
              status: "draft",
              dueLabel: due(p.daysUntilDue),
              paymentUrl: null,
            },
          });
          action.result = { ...receipt };
        } else if (action.action_type === "send_stripe_invoice") {
          const item = invoice(action.payload.creationActionId);
          if ((await digest(item.document)) !== action.digest)
            throw new Error("Invoice changed; prepare a fresh send");
          item.receipt.status = "open";
          item.receipt.delivery = "not_sent_test_mode";
          item.document.status = "open";
          action.result = { ...item.receipt };
        } else if (action.action_type === "publish_invoice_page") {
          const current = await view(action.payload.creationActionId, action.payload.design);
          if (current.digest !== action.digest)
            throw new Error("Invoice or branding changed; preview again");
          const p: Page = {
            id: crypto.randomUUID(),
            creationActionId: String(action.payload.creationActionId),
            token: crypto.randomUUID(),
            expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
            revokedAt: null,
            brand: structuredClone(state.brand),
            design: current.design,
          };
          state.pages.unshift(p);
          action.result = { pageId: p.id };
        } else {
          const input = action.payload;
          const source = pack.opportunities.find(
            (x) => x.id === (input.opportunityId ?? input.meetingId),
          );
          if (!source || (action.pluginId === "client-onboarding" && source.stage !== "won"))
            throw new Error("Source record changed");
          const planned = z.array(taskSchema).min(1).max(10).parse(input.tasks);
          const tasks = planned.map((t) => {
            const prior = state.tasks.find(
              (x) =>
                x.sourceId === source.id &&
                x.title === t.title &&
                x.dueDate === t.dueDate &&
                x.assigneeUserId === t.assigneeUserId &&
                x.description === t.description,
            );
            if (prior) return prior;
            const task = {
              ...t,
              id: crypto.randomUUID(),
              personId: source.personId,
              sourceId: source.id,
              status: "pending",
            };
            state.tasks.push(task);
            return task;
          });
          action.result = { complete: true, tasks: structuredClone(tasks) };
        }
        action.status = "executed";
        record("Approved " + action.title);
        return response({ result: action.result, simulated: true });
      } catch (error) {
        action.status = "failed";
        action.error = error instanceof Error ? error.message : "Simulated action failed";
        record("Refused " + action.title);
        throw error;
      }
    }
    if (["/api/admin/tasks", "/api/admin/revenue-os/tasks"].includes(path) && method === "PATCH") {
      const task = state.tasks.find((x) => x.id === body.id);
      if (!task) return null;
      if (body.action !== "complete") throw new Error("Unsupported demo task change");
      task.status = "completed";
      record("Completed " + task.title);
      return response({ task, simulated: true });
    }
    if (path === "/api/admin/plugins/run" && method === "POST") {
      const id = String(body.pluginId);
      requireEnabled(id);
      const def = REVENUE_OS_MODULES.find((x) => x.id === id);
      if (!def?.report) throw new Error("Unknown report");
      const rows =
        id === "commitment-watch"
          ? pack.tasks
              .filter((x) => x.status !== "completed")
              .map((x) => ({
                source: "tasks",
                id: x.id,
                title: x.title,
                detail: "Open fictional commitment",
                severity: "attention",
              }))
          : pack.opportunities
              .filter((x) => x.stage !== "won" && x.stage !== "lost")
              .map((x) => ({
                source: "opportunities",
                id: x.id,
                title: x.name,
                detail: x.nextAction,
                severity: "info",
              }));
      record("Simulated " + def.name);
      return response({
        summary: "Simulated report from this fictional workspace.",
        items: rows.slice(0, 20),
        totalFindings: rows.length,
        receipt: {
          runId: crypto.randomUUID(),
          pluginId: id,
          sha256: "demo",
          inspectedRows: rows.length,
          truncated: rows.length > 20,
          generatedAt: now(),
          elapsedMs: 0,
        },
        simulated: true,
      });
    }
    return null;
  } catch (error) {
    return response(
      {
        error:
          error instanceof z.ZodError
            ? "Check the required fields and values"
            : error instanceof Error
              ? error.message
              : "Demo operation refused",
        simulated: true,
      },
      422,
    );
  }
}
