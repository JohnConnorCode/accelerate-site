import { handleDemoBilling, type DemoBillingState } from "./billing-runtime";
import { handleDemoSocial, type DemoSocialState } from "./social-runtime";
import type { DemoEventTicketState } from "./event-ticketing-runtime";
import { handleDemoConfiguration, type DemoConfigurationState } from "./configuration-runtime";
import { getLayoutScope } from "@/lib/admin/layout-scopes";
import { validateAdminTheme } from "@/lib/admin/theme-definition";
import {
  prepareOperatorTaskPatch,
  type OperatorTaskPatchInput,
} from "@/lib/revenue-os/operator-task-patch";
import { handleDemoRadar } from "./radar-runtime";
import type { DemoRadarState } from "./radar-fixtures";
import { handleDemoCollections } from "./collections-runtime";
import type { CollectionCaseView } from "@/lib/revenue-os/collection-contract";
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
  invoiceCommandSchema,
  invoiceTotal,
  type InvoiceRecord,
} from "@/lib/revenue-os/invoice-contract";
import type { InvoiceDocumentData } from "@/components/business/InvoiceDocument";
import { REVENUE_OS_MODULES, type ModuleSettingsConfig } from "@/lib/revenue-os/modules";

export const DEMO_BUSINESS_MODULES = {
  "site-studio": true,
  "social-marketing": true,
  "opportunity-radar": true,
  "receivables-collections": true,
  "invoicing": true,
  "client-onboarding": true,
  "meeting-commitments": true,
};
type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority?: string;
  snoozedUntil?: string | null;
  completedAt?: string | null;
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
  expires_at?: string;
  requestId?: string;
  digest?: string;
};
/** The demo keeps the same invoice records the real workspace stores. */
export function demoInvoiceDocument(invoice: InvoiceRecord): InvoiceDocumentData {
  const paid = invoice.status === "paid" || invoice.status === "paid_external";
  return {
    number: invoice.number ?? "Draft",
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    currency: "usd",
    lines: invoice.lines.map((x) => ({ description: x.description, amount: x.quantity * x.unitCents })),
    total: invoice.totalCents,
    amountPaid: paid ? invoice.totalCents : 0,
    amountRemaining: paid ? 0 : invoice.totalCents,
    status: paid ? "paid" : invoice.status,
    dueLabel: invoice.dueDate ?? "Due on receipt",
    paymentUrl: null,
  };
}
export type DemoBusinessState = {
  billing?: DemoBillingState;
  eventTickets?: DemoEventTicketState;
  configuration?: DemoConfigurationState;
  social?: DemoSocialState;
  radar?: DemoRadarState;
  collections?: CollectionCaseView[];
  version: 2;
  brand: WorkspaceBrand;
  brandRevision: number;
  actions: Action[];
  invoices: InvoiceRecord[];
  invoiceCounter: number;
  tasks: Task[];
  receipts: {
    id: string;
    operation: string;
    at: string;
    simulated: true;
    sourceType?: string;
    sourceId?: string;
  }[];
};
const memberId = "00000000-0000-4000-8000-000000000079";
const now = () => new Date().toISOString();
const due = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
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
export { digest as demoBusinessDigest };
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
    version: 2,
    brand,
    brandRevision: 1,
    actions: [],
    invoices: [],
    invoiceCounter: 0,
    tasks: [],
    receipts: [],
  };
  for (const [index, status] of (["open", "paid", "draft"] as const).entries()) {
    const contact = pack.people[index]!;
    const lines = pack.business.invoiceLines.map((x) => ({
      description: x.description,
      quantity: x.quantity,
      unitCents: x.unitAmount,
    }));
    const issued = status !== "draft";
    if (issued) state.invoiceCounter++;
    state.invoices.push({
      id: `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
      number: issued ? `INV-${String(state.invoiceCounter).padStart(4, "0")}` : null,
      contactId: contact.id,
      customerName: contact.name,
      customerEmail: contact.email,
      currency: "usd",
      lines,
      totalCents: invoiceTotal(lines),
      amountPaidCents: status === "paid" ? invoiceTotal(lines) : 0,
      refundedCents: 0,
      memo: pack.business.invoiceMemo,
      dueDate: due(index === 0 ? -5 : 14),
      paymentMethods: ["us_bank_account", "card"],
      status,
      testMode: issued ? true : null,
      issuedAt: issued ? now() : null,
      paidAt: status === "paid" ? now() : null,
      voidedAt: null,
      externalPaymentNote: "",
      revision: 1,
      createdAt: now(),
      shareUrl: null,
    });
  }
  const won = pack.opportunities.find((x) => x.stage === "won")!;
  for (const [index, pluginId] of ["client-onboarding", "meeting-commitments"].entries()) {
    const source = index === 0 ? won : pack.opportunities[1]!;
    const titles = index === 0 ? pack.business.onboarding : pack.business.commitments;
    const tasks = titles.slice(0, 2).map((title, i) => ({
      id: crypto.randomUUID(),
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
    dueOffset: t.dueDate ? Math.ceil((Date.parse(t.dueDate) - Date.now()) / 86400000) : 0,
    priority: t.priority ?? "medium",
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
  moduleSettings: ModuleSettingsConfig = {},
): Promise<Response | null> {
  const configurationResponse = await handleDemoConfiguration(pack, state, url, method, body, save);
  if (configurationResponse) return configurationResponse;
  const socialResponse = await handleDemoSocial(pack, state, modules, url, method, body, save);
  if (socialResponse) return socialResponse;
  const radarResponse = await handleDemoRadar(
    pack,
    state,
    modules,
    url,
    method,
    body,
    save,
    moduleSettings,
  );
  if (radarResponse) return radarResponse;
  const collectionResponse = await handleDemoCollections(
    pack,
    state,
    modules,
    url,
    method,
    body,
    save,
    moduleSettings,
  );
  if (collectionResponse) return collectionResponse;
  const path = url.pathname;
  if (method === "GET" && path === "/api/admin/revenue-os/layout") {
    const scope = url.searchParams.get("scope");
    if (!scope || !getLayoutScope(scope)) {
      return Response.json({ error: "Unknown layout scope" }, { status: 400 });
    }
    return Response.json({ scope, doc: null, history: [] });
  }
  const enabled = (id: string) => modules[id] ?? false;
  const requireEnabled = (id: string) => {
    if (!enabled(id))
      throw new Error("This plugin is disabled. Enable it from Plugins to continue.");
  };
  const record = (operation: string, sourceType?: string, sourceId?: string) => {
    state.receipts.unshift({
      id: crypto.randomUUID(),
      operation,
      at: now(),
      simulated: true,
      sourceType,
      sourceId,
    });
    state.receipts = state.receipts.slice(0, 100);
    save();
  };
  const invoice = (id: unknown) => {
    const item = state.invoices.find((x) => x.id === id);
    if (!item) throw new Error("Invoice is unavailable in this demo workspace");
    return item;
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
    const billingResponse = await handleDemoBilling(
      pack,
      state,
      modules,
      url,
      method,
      body,
      save,
      digest,
    );
    if (billingResponse) return billingResponse;
    if (path === "/api/admin/tenant/branding") {
      if (method === "GET")
        return response({
          brand: state.brand,
          revision: revision(state),
          previewInvoice: state.invoices[0] ? demoInvoiceDocument(state.invoices[0]) : undefined,
          simulated: true,
        });
      if (method !== "PUT") return response({ error: "Unsupported branding operation" }, 405);
      if (body.revision !== revision(state))
        throw new Error("Branding changed. Reload before saving.");
      const brand = workspaceBrandSchema.parse(body.brand);
      if (brand.adminTheme) validateAdminTheme(brand.adminTheme);
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
        previewInvoice: state.invoices[0] ? demoInvoiceDocument(state.invoices[0]) : undefined,
        simulated: true,
      });
    }
    if (path === "/api/admin/invoicing" && method === "GET") {
      requireEnabled("invoicing");
      return response({
        simulated: true,
        invoices: state.invoices,
        contacts: pack.people.map((x) => ({ id: x.id, full_name: x.name, primary_email: x.email })),
        stripe: { connected: true, testMode: true, canTakePayments: true },
      });
    }
    if (path === "/api/admin/invoicing" && method === "POST") {
      requireEnabled("invoicing");
      const command = invoiceCommandSchema.parse(body);
      let item: InvoiceRecord;
      if (command.operation === "save_draft") {
        const fields = {
          contactId: command.draft.contactId,
          customerName: command.draft.customerName,
          customerEmail: command.draft.customerEmail.toLowerCase(),
          lines: command.draft.lines,
          totalCents: invoiceTotal(command.draft.lines),
          memo: command.draft.memo,
          dueDate: command.draft.dueDate,
          paymentMethods: command.draft.paymentMethods,
        };
        if (command.id) {
          item = invoice(command.id);
          if (item.status !== "draft") throw new Error("Only a draft can be edited");
          if (item.revision !== command.revision) throw new Error("This draft changed. Reload it.");
          Object.assign(item, fields, { revision: item.revision + 1 });
        } else {
          item = {
            ...fields,
            id: crypto.randomUUID(),
            number: null,
            currency: "usd",
            amountPaidCents: 0,
            refundedCents: 0,
            status: "draft",
            testMode: null,
            issuedAt: null,
            paidAt: null,
            voidedAt: null,
            externalPaymentNote: "",
            revision: 1,
            createdAt: now(),
            shareUrl: null,
          };
          state.invoices.unshift(item);
        }
        record("Saved invoice draft", "invoice", item.id);
      } else {
        item = invoice(command.id);
        if (command.operation === "issue") {
          if (item.status === "draft") {
            state.invoiceCounter++;
            Object.assign(item, {
              status: "open",
              number: `INV-${String(state.invoiceCounter).padStart(4, "0")}`,
              issuedAt: now(),
              testMode: true,
              revision: item.revision + 1,
            });
            record("Simulated invoice issue", "invoice", item.id);
          }
        } else if (command.operation === "void" || command.operation === "record_external_payment") {
          if (!["draft", "open"].includes(item.status)) throw new Error("This invoice is already closed");
          if (command.operation === "record_external_payment" && item.status === "draft")
            throw new Error("Issue the invoice before recording a payment");
          Object.assign(
            item,
            command.operation === "void"
              ? { status: "void", voidedAt: now() }
              : {
                  status: "paid_external",
                  paidAt: now(),
                  amountPaidCents: item.totalCents,
                  externalPaymentNote: command.note,
                },
            { revision: item.revision + 1 },
          );
          record(command.operation === "void" ? "Voided invoice" : "Recorded outside payment", "invoice", item.id);
        }
      }
      return response({ invoice: item, simulated: true });
    }
    if (path === "/api/admin/plugins/tasks" && method === "GET") {
      const id = url.searchParams.get("pluginId");
      if (!["client-onboarding", "meeting-commitments"].includes(id ?? ""))
        throw new Error("Unknown workflow");
      const sourceId = url.searchParams.get("sourceId");
      if (sourceId) z.uuid().parse(sourceId);
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
      {
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
    if (path === "/api/admin/revenue-os/actions" && method === "PATCH") {
      const action = state.actions.find((x) => x.id === body.id);
      if (!action) return null;
      if (body.decision === "reject") {
        if (action.status !== "pending") throw new Error("Action already handled");
        action.status = "rejected";
        record("Rejected " + action.title, "approval", action.id);
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
        {
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
        record("Approved " + action.title, "approval", action.id);
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
      const input =
        path === "/api/admin/revenue-os/tasks"
          ? body.action === "complete"
            ? { id: task.id, status: "completed" }
            : body.action === "snooze" && typeof body.until === "string"
              ? { id: task.id, snoozed_until: body.until as string }
              : null
          : (body as unknown as OperatorTaskPatchInput);
      if (!input) throw new Error("Unsupported task action");
      const before = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        due_date: task.dueDate,
        priority: task.priority ?? "medium",
        snoozed_until: task.snoozedUntil ?? null,
        completed_at: task.completedAt ?? null,
      };
      const patch = prepareOperatorTaskPatch(before, input, path === "/api/admin/revenue-os/tasks");
      const updated = { ...before, ...patch };
      task.title = updated.title as string;
      task.description = (updated.description ?? "") as string;
      task.status = updated.status as string;
      task.dueDate = updated.due_date as string | null;
      task.priority = updated.priority as string;
      task.snoozedUntil = updated.snoozed_until as string | null;
      task.completedAt = updated.completed_at as string | null;
      if (Object.keys(patch).some((key) => before[key as keyof typeof before] !== patch[key]))
        record(
          (task.status === "completed"
            ? "Completed "
            : task.status === "snoozed"
              ? "Snoozed "
              : "Updated ") + task.title,
          "task",
          task.id,
        );
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
        summary: "Simulated report from this demo workspace.",
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
