"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { BillingNavigation } from "@/components/admin/BillingNavigation";
import { PaymentIndex } from "@/components/admin/PaymentIndex";
import { BillingActivity } from "@/components/admin/BillingActivity";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { DemoBusinessNotice } from "@/components/admin/DemoBusinessNotice";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { InvoiceExperience } from "@/components/invoices/InvoiceExperience";
import { StripeConnectPanel } from "@/components/invoices/StripeConnectPanel";
import {
  InvoiceEditorFields,
  type InvoiceContact,
  type InvoiceFieldIssue,
} from "@/components/invoices/InvoiceEditorFields";
import {
  emptyInvoiceDraft,
  invoiceDraftSchema,
  invoiceStatusLabels as statusNames,
  invoiceSubtotal,
  money,
  type CommercialInvoice,
  type InvoiceDraft,
} from "@/lib/invoices/schema";
import type { InvoiceCommand } from "@/lib/invoices/commands";
import type { InvoiceBrand } from "@/lib/invoices/brand";

const button = "admin-button admin-button--secondary";
const primary = "admin-button admin-button--primary";
type Listing = {
  invoices: CommercialInvoice[];
  contacts: InvoiceContact[];
  stripe: { connected: boolean; testMode: boolean; canTakePayments: boolean };
  brand: InvoiceBrand;
};
const fieldNames: Record<string, string> = {
  company_name: "Client name",
  contact_name: "Contact name",
  contact_email: "Client email",
  description: "Invoice description",
  discount_cents: "Discount",
  due_date: "Due date",
  payment_methods: "Payment methods",
};
function fieldIssues(draft: InvoiceDraft): InvoiceFieldIssue[] {
  const result = invoiceDraftSchema.safeParse(draft);
  if (result.success) return [];
  return result.error.issues.map((i) => ({
    field: i.path.join("."),
    message: `${
      fieldNames[String(i.path[0])] ||
      (i.path[0] === "lines"
        ? i.path.length === 1
          ? "Line items"
          : `Item ${Number(i.path[1]) + 1} ${i.path[2] === "unit_cents" ? "rate" : String(i.path[2] ?? "")}`
        : i.path.join(" "))
    }: ${i.message}`,
  }));
}
const DRAFT_KEYS = Object.keys(emptyInvoiceDraft()) as (keyof InvoiceDraft)[];
const draftOf = (invoice: CommercialInvoice): InvoiceDraft =>
  Object.fromEntries(DRAFT_KEYS.map((key) => [key, invoice[key]])) as InvoiceDraft;
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { dateStyle: "medium" });

/** Invoicing workspace, ported from SuperDebate's invoice admin: saved
 * invoices, an editor with a live recipient preview, and the payment link. */
export default function InvoicingPage() {
  const params = useSearchParams();
  const payments = params.get("view") === "payments";
  const linkedContact = params.get("contactId");
  const listing = useAdminQuery<Listing>(
    ["admin", "invoicing", linkedContact],
    `/api/admin/invoicing${linkedContact ? `?contactId=${encodeURIComponent(linkedContact)}` : ""}`,
  );
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={payments ? "Payments & refunds" : "Invoices"}
        subtitle={
          payments
            ? "Review payments and refunds from your Stripe account."
            : "Clients pay by bank transfer or card on your own invoice page. No Stripe invoice fees."
        }
      />
      <DemoBusinessNotice />
      <BillingNavigation active={payments ? "payments" : "invoices"} />
      {listing.error && !listing.data ? (
        <p role="alert" className="rounded-xl bg-[var(--admin-danger-soft)] p-4 text-sm">
          {listing.error.message}
        </p>
      ) : !listing.data ? (
        <p role="status" className="admin-copy">
          Loading invoices…
        </p>
      ) : payments ? (
        <>
          <PaymentIndex enabled={listing.data.stripe.connected} connectionKey="stripe" />
          <BillingActivity />
        </>
      ) : (
        <InvoiceWorkspace
          listing={listing.data}
          initialInvoiceId={params.get("invoiceId")}
          startNew={params.get("view") === "new" || params.get("view") === "create"}
          linkedContactId={linkedContact}
        />
      )}
    </div>
  );
}

function InvoiceWorkspace({
  listing,
  initialInvoiceId,
  startNew,
  linkedContactId,
}: {
  listing: Listing;
  initialInvoiceId: string | null;
  startNew: boolean;
  linkedContactId: string | null;
}) {
  const cache = useQueryClient();
  const { invoices, contacts, stripe, brand } = listing;
  const seedContact = contacts.find((c) => c.id === linkedContactId);
  const newDraft = (): InvoiceDraft => ({
    ...emptyInvoiceDraft(),
    ...(seedContact
      ? {
          contact_id: seedContact.id,
          company_name: seedContact.full_name,
          contact_name: seedContact.full_name,
          contact_email: seedContact.primary_email,
        }
      : {}),
  });
  const initial = invoices.find((i) => i.id === initialInvoiceId) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [composing, setComposing] = useState(Boolean(initial) || startNew);
  const [draft, setDraft] = useState<InvoiceDraft>(initial ? draftOf(initial) : newDraft());
  const [saved, setSaved] = useState<string>(JSON.stringify(initial ? draftOf(initial) : null));
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [issues, setIssues] = useState<InvoiceFieldIssue[]>([]);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [copied, setCopied] = useState(false),
    [externalNote, setExternalNote] = useState("");
  const selected = invoices.find((i) => i.id === selectedId) ?? null;
  const editable = !selected || selected.status === "draft";
  const dirty = editable && JSON.stringify(draft) !== saved;
  const amount = invoiceSubtotal(draft.lines) - draft.discount_cents;
  const remaining = fieldIssues(draft);
  const shareLink = selected?.share_url
    ? new URL(selected.share_url, window.location.origin).href
    : null;
  const filtered = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (filter === "all" ||
            (filter === "paid" && (i.status === "paid" || i.status === "paid_external")) ||
            (filter === "open" && (i.status === "open" || i.status === "processing")) ||
            i.status === filter) &&
          `${i.company_name} ${i.contact_email} ${i.invoice_number || ""} ${i.description}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [invoices, filter, search],
  );
  const outstanding = invoices
    .filter((i) => i.status === "open" || i.status === "processing")
    .reduce((n, i) => n + i.amount_cents, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((n, i) => n + i.amount_cents, 0);
  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const preview = {
    ...draft,
    status: selected?.status || "draft",
    invoice_number: selected?.invoice_number || null,
    issued_at: selected?.issued_at || null,
    due_at: selected?.due_at || null,
    paid_at: selected?.paid_at || null,
  };
  const set = <K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setIssues((current) =>
      current.filter((i) => i.field !== key && !i.field.startsWith(`${String(key)}.`)),
    );
  };
  function choose(invoice: CommercialInvoice) {
    setSelectedId(invoice.id);
    setComposing(true);
    setDraft(draftOf(invoice));
    setSaved(JSON.stringify(draftOf(invoice)));
    setError("");
    setNotice("");
    setIssues([]);
    setCopied(false);
    window.history.replaceState(null, "", `${window.location.pathname}?invoiceId=${invoice.id}`);
  }
  function fresh() {
    setSelectedId(null);
    setComposing(true);
    setDraft(newDraft());
    setSaved("null");
    setError("");
    setNotice("");
    setIssues([]);
    window.history.replaceState(null, "", `${window.location.pathname}?view=new`);
  }
  function duplicate() {
    setSelectedId(null);
    setSaved("null");
    setNotice("Copied into a new draft. Review it, then save.");
    window.history.replaceState(null, "", `${window.location.pathname}?view=new`);
  }
  async function run(command: InvoiceCommand, working: string, success: string) {
    setBusy(working);
    setError("");
    setNotice("");
    try {
      const { invoice } = await fetchJson<{ invoice: CommercialInvoice }>("/api/admin/invoicing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      await cache.invalidateQueries({ queryKey: ["admin", "invoicing"] });
      setSelectedId(invoice.id);
      setDraft(draftOf(invoice));
      setSaved(JSON.stringify(draftOf(invoice)));
      window.history.replaceState(null, "", `${window.location.pathname}?invoiceId=${invoice.id}`);
      setNotice(success);
      return invoice;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The invoice could not be updated. Your details are retained. Try again.",
      );
      return null;
    } finally {
      setBusy("");
    }
  }
  async function save() {
    const found = fieldIssues(draft);
    setIssues(found);
    if (found.length) {
      setError("Complete the highlighted details.");
      return null;
    }
    return run(
      {
        operation: "save_draft",
        id: selected?.id ?? null,
        revision: selected?.revision ?? null,
        draft,
      },
      "Saving draft…",
      "Draft saved. It stays private until you generate its payment link.",
    );
  }
  async function generate() {
    const current = dirty || !selected ? await save() : selected;
    if (!current) return;
    await run(
      { operation: "issue", id: current.id, revision: current.revision },
      "Generating payment link…",
      "Payment link ready. Copy it and send it to your client.",
    );
  }
  async function copyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Select and copy the payment link below.");
    }
  }
  const locked = Boolean(busy);
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="admin-copy text-sm">
          {stripe.testMode
            ? "Stripe test mode · these invoices cannot collect real payments."
            : "Amounts cover the invoices in this workspace."}
        </p>
        <button type="button" className={primary} disabled={locked} onClick={fresh}>
          <Plus className="size-4" aria-hidden="true" />
          Create invoice
        </button>
      </div>
      {!stripe.canTakePayments && (
        <StripeConnectPanel
          connected={stripe.connected}
          onConnected={() =>
            Promise.all([
              cache.invalidateQueries({ queryKey: ["admin", "invoicing"] }),
              cache.invalidateQueries({ queryKey: ["tenant", "providers"] }),
            ]).then(() => undefined)
          }
        />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric title="Unpaid" value={money(outstanding)} detail="Issued and awaiting payment" />
        <Metric
          title="Paid on Stripe"
          value={money(paid)}
          detail="Excludes payments recorded externally"
        />
        <Metric
          title="Saved drafts"
          value={String(draftCount)}
          detail="Not yet shared with the client"
        />
      </div>
      {notice && (
        <p role="status" className="rounded-xl bg-[var(--admin-success-soft)] p-4 text-sm">
          {notice}
        </p>
      )}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <AdminSurface padding="md" className="min-w-0 self-start">
          <h3 className="text-lg font-semibold">Saved invoices</h3>
          <input
            aria-label="Search invoices"
            className="admin-field mt-4 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or invoice…"
          />
          <select
            aria-label="Filter invoices"
            className="admin-field mt-3 w-full"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ["all", "All invoices"],
              ["draft", "Drafts"],
              ["open", "Unpaid"],
              ["paid", "Paid"],
              ["void", "Void"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="mt-4 max-h-[600px] space-y-2 overflow-auto">
            {filtered.length ? (
              filtered.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  disabled={locked}
                  onClick={() => choose(i)}
                  className={`w-full rounded-xl p-3 text-left transition-colors ${selected?.id === i.id ? "bg-[var(--admin-surface-subtle)] ring-1 ring-[var(--admin-border)]" : "hover:bg-[var(--admin-surface-subtle)]"}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <strong className="min-w-0 text-sm break-words">{i.company_name}</strong>
                    <span className="shrink-0 text-sm tabular-nums">{money(i.amount_cents)}</span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="rounded-full bg-[var(--admin-surface-subtle)] px-2 py-1 font-medium">
                      {statusNames[i.status]}
                    </span>
                    <span className="text-[var(--admin-muted)]">
                      {i.invoice_number || date(i.updated_at || i.created_at)}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="admin-copy py-6 text-sm">
                {filter === "draft"
                  ? "No saved drafts match. Create an invoice to start one."
                  : "No matching invoices."}
              </p>
            )}
          </div>
        </AdminSurface>
        <div className="min-w-0 space-y-5">
          {!composing ? (
            <AdminSurface padding="lg">
              <h2 className="text-xl font-semibold">
                {invoices.length ? "Choose an invoice" : "No invoices yet"}
              </h2>
              <p className="admin-copy mt-3 max-w-lg text-sm leading-6">
                {invoices.length
                  ? "Choose an invoice to edit its details or copy its payment link."
                  : "Use Create invoice to add a client and agreed amount."}
              </p>
            </AdminSurface>
          ) : (
            <>
              <AdminSurface padding="lg" className="min-w-0">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {selected?.invoice_number && (
                      <p className="mb-1 text-xs font-medium text-[var(--admin-muted)]">
                        {selected.invoice_number}
                      </p>
                    )}
                    <h2 className="text-xl font-semibold">
                      {editable
                        ? selected
                          ? "Edit draft"
                          : "Invoice draft"
                        : selected?.company_name}
                    </h2>
                    <p className="admin-copy mt-2 text-sm">
                      {editable
                        ? dirty
                          ? "Unsaved changes. Generating the payment link saves them automatically."
                          : selected
                            ? "Review the details, then generate the payment link to share with your client."
                            : "Client and pricing details are required. Billing address is optional."
                        : selected?.status === "paid" || selected?.status === "paid_external"
                          ? "This invoice has been paid. Its saved details record the payment."
                          : selected?.status === "void"
                            ? "This invoice is void. You can duplicate it for a new agreement."
                            : "Issued invoices cannot be edited. Void and duplicate it to change the terms."}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--admin-surface-subtle)] px-3 py-2 text-xs font-medium">
                    {selected ? statusNames[selected.status] : "New draft"} · USD
                    {selected?.mode === "test" ? " · Test" : ""}
                  </span>
                </div>
                {editable && (
                  <div
                    className={`${dirty || busy ? "sticky top-20 z-10 " : ""}mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--admin-surface-subtle)] p-3`}
                  >
                    <div className="text-sm">
                      {busy ? (
                        <span role="status">{busy}</span>
                      ) : (
                        <span>
                          {remaining.length
                            ? `${remaining.length} ${remaining.length === 1 ? "detail" : "details"} to complete`
                            : "Ready to generate"}
                        </span>
                      )}
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                      <button
                        type="button"
                        className={button}
                        disabled={locked || Boolean(selected && !dirty)}
                        onClick={() => void save()}
                      >
                        {selected ? "Save changes" : "Save draft"}
                      </button>
                      <button
                        type="button"
                        className={primary}
                        disabled={locked || !stripe.connected}
                        onClick={() => void generate()}
                      >
                        Generate payment link
                      </button>
                    </div>
                  </div>
                )}
                {error && (
                  <div
                    role="alert"
                    className="mb-5 rounded-xl bg-[var(--admin-danger-soft)] p-4 text-sm"
                  >
                    <p className="font-medium">{error}</p>
                    {issues.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {issues.map((i) => (
                          <li key={i.field}>
                            <a
                              className="underline underline-offset-2"
                              href={"#invoice-field-" + i.field}
                            >
                              {i.message}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {shareLink && selected && (
                  <section
                    aria-label="Payment link"
                    className="mb-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-success-soft)] p-4"
                  >
                    <h3 className="font-semibold">
                      {selected.status === "open" ? "Payment link ready" : "Recipient link"}
                    </h3>
                    <p className="admin-copy mt-1 text-sm">
                      {selected.status === "open"
                        ? "Payment has not been received. Share this private link with the client to collect payment."
                        : `This invoice is ${statusNames[selected.status].toLowerCase()}. The recipient page shows its current status.`}
                    </p>
                    <label
                      className="mt-3 block text-sm font-medium"
                      htmlFor="invoice-payment-link"
                    >
                      Recipient link
                    </label>
                    <input
                      id="invoice-payment-link"
                      className="admin-field mt-2 w-full"
                      value={shareLink}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className={button} onClick={() => void copyLink()}>
                        {copied ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : (
                          <Copy className="size-4" aria-hidden="true" />
                        )}
                        {copied ? "Copied" : "Copy payment link"}
                      </button>
                      <a className={button} href={shareLink} target="_blank" rel="noreferrer">
                        Open recipient page
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                      {(selected.status === "open" || selected.status === "processing") && (
                        <button
                          type="button"
                          className={button}
                          disabled={locked}
                          onClick={() =>
                            void run(
                              { operation: "refresh_payment", id: selected.id },
                              "Checking payment…",
                              "Payment status checked with Stripe.",
                            )
                          }
                        >
                          <RefreshCw className="size-4" aria-hidden="true" />
                          Check payment status
                        </button>
                      )}
                    </div>
                  </section>
                )}
                {editable ? (
                  <InvoiceEditorFields
                    draft={draft}
                    set={set}
                    issues={issues}
                    contacts={contacts}
                    disabled={locked}
                  />
                ) : (
                  <details className="rounded-xl border border-[var(--admin-border)] p-4">
                    <summary className="min-h-10 cursor-pointer text-sm font-medium">
                      Saved invoice details
                    </summary>
                    <div className="mt-4">
                      <InvoiceEditorFields
                        draft={draft}
                        set={set}
                        issues={issues}
                        contacts={contacts}
                        disabled
                      />
                    </div>
                  </details>
                )}
                {selected?.status === "open" && (
                  <div className="mt-5 grid gap-2 rounded-xl border border-[var(--admin-border)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <label className="text-sm font-medium" htmlFor="external-note">
                        Paid another way? Record how
                      </label>
                      <input
                        id="external-note"
                        className="admin-field mt-2 w-full"
                        maxLength={300}
                        placeholder="Wire received December 2"
                        value={externalNote}
                        onChange={(e) => setExternalNote(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className={button}
                      disabled={locked || !externalNote.trim()}
                      onClick={() =>
                        void run(
                          {
                            operation: "record_external_payment",
                            id: selected.id,
                            revision: selected.revision,
                            note: externalNote,
                          },
                          "Recording payment…",
                          "Recorded as paid externally. The online payment was cancelled.",
                        )
                      }
                    >
                      Mark as paid
                    </button>
                  </div>
                )}
                {selected && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--admin-border)] pt-4">
                    <button type="button" className={button} disabled={locked} onClick={duplicate}>
                      Duplicate as new draft
                    </button>
                    {selected.status === "draft" && (
                      <button
                        type="button"
                        className={button}
                        disabled={locked}
                        onClick={() =>
                          void run(
                            {
                              operation: "delete_draft",
                              id: selected.id,
                              revision: selected.revision,
                            },
                            "Deleting draft…",
                            "Draft deleted.",
                          )
                        }
                      >
                        Delete draft
                      </button>
                    )}
                    {selected.status === "open" && (
                      <button
                        type="button"
                        className={button}
                        disabled={locked}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Void this invoice? The client's link stops accepting payment.",
                            )
                          )
                            void run(
                              { operation: "void", id: selected.id, revision: selected.revision },
                              "Voiding invoice…",
                              "Invoice voided.",
                            );
                        }}
                      >
                        Void invoice
                      </button>
                    )}
                  </div>
                )}
              </AdminSurface>
              <section className="min-w-0 space-y-3">
                <h2 className="text-lg font-semibold">Recipient preview</h2>
                <div className="rounded-2xl bg-[#eeece7] p-3 sm:p-6">
                  <InvoiceExperience
                    invoice={preview}
                    brand={brand}
                    apiUrl={null}
                    amount={amount}
                    preview
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <AdminSurface padding="md">
      <p className="text-xs font-medium text-[var(--admin-muted)]">{title}</p>
      <strong className="mt-2 block text-2xl font-semibold tabular-nums">{value}</strong>
      <p className="mt-1 text-xs text-[var(--admin-muted)]">{detail}</p>
    </AdminSurface>
  );
}
