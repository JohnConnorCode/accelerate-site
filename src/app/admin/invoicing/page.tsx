"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Plus, ReceiptText, RefreshCw, Trash2 } from "lucide-react";
import { BillingNavigation } from "@/components/admin/BillingNavigation";
import { PaymentIndex } from "@/components/admin/PaymentIndex";
import { BillingActivity } from "@/components/admin/BillingActivity";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { DemoBusinessNotice } from "@/components/admin/DemoBusinessNotice";
import AdminLink from "@/components/admin/AdminLink";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import {
  INVOICE_PAYMENT_METHODS,
  invoiceMoney,
  invoicePaymentMethodLabels,
  invoiceStatusLabels,
  invoiceTotal,
  parseDollars,
  type InvoiceCommand,
  type InvoicePaymentMethod,
  type InvoiceRecord,
} from "@/lib/revenue-os/invoice-contract";

const button = "admin-button admin-button--secondary";
const primary = "admin-button admin-button--primary";
const field = "admin-field mt-2";
type Listing = {
  invoices: InvoiceRecord[];
  contacts: { id: string; full_name: string; primary_email: string }[];
  stripe: { connected: boolean; testMode: boolean; canTakePayments: boolean };
};
type LineInput = { description: string; quantity: number; amount: string };
const statusTone: Record<string, string> = {
  paid: "bg-[var(--admin-success-soft)]",
  paid_external: "bg-[var(--admin-success-soft)]",
  processing: "bg-[var(--admin-warning-soft)]",
};
const date = (value: string | null) =>
  value
    ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: value.length === 10 ? "UTC" : undefined,
      })
    : "None";

export default function InvoicingPage() {
  const params = useSearchParams();
  const view = params.get("view");
  const id = params.get("id");
  const cache = useQueryClient();
  const linkedContact = view === "new" ? params.get("contactId") : null;
  const listing = useAdminQuery<Listing>(
    ["admin", "invoicing", linkedContact],
    `/api/admin/invoicing${linkedContact ? `?contactId=${encodeURIComponent(linkedContact)}` : ""}`,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = listing.data?.invoices.find((invoice) => invoice.id === id) ?? null;

  async function command(body: InvoiceCommand, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fetchJson<{ invoice: InvoiceRecord }>("/api/admin/invoicing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await cache.invalidateQueries({ queryKey: ["admin", "invoicing"] });
      setNotice(success);
      return result.invoice;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invoice could not be saved");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const header =
    view === "new"
      ? "New invoice"
      : view === "edit"
        ? "Edit draft"
        : view === "invoice" && selected
          ? (selected.number ?? "Draft invoice")
          : view === "payments"
            ? "Payments & refunds"
            : "Invoices";
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={header}
        subtitle={
          view === "payments"
            ? "Review payments and refunds from your Stripe account."
            : "Customers pay by bank transfer or card on your own invoice page."
        }
        actions={
          view && view !== "payments" ? (
            <AdminLink href="/admin/invoicing" className={button}>
              All invoices
            </AdminLink>
          ) : (
            <AdminLink href="/admin/invoicing?view=new" className={primary}>
              <Plus className="size-4" aria-hidden="true" />
              New invoice
            </AdminLink>
          )
        }
      />
      <DemoBusinessNotice />
      {(!view || view === "payments") && (
        <BillingNavigation active={view === "payments" ? "payments" : "invoices"} />
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-[var(--admin-danger-soft)] p-4 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm">
          {notice}
        </p>
      )}
      {listing.error && !listing.data ? (
        <p role="alert" className="rounded-xl bg-[var(--admin-danger-soft)] p-4 text-sm">
          {listing.error.message}
        </p>
      ) : !listing.data ? (
        <p role="status" className="admin-copy">
          Loading invoices…
        </p>
      ) : view === "payments" ? (
        <>
          <PaymentIndex enabled={listing.data.stripe.connected} connectionKey="stripe" />
          <BillingActivity />
        </>
      ) : !listing.data.stripe.connected ? (
        <StripeConnection onConnected={() => cache.invalidateQueries({ queryKey: ["admin", "invoicing"] })} />
      ) : view === "new" || (view === "edit" && selected) ? (
        <InvoiceForm
          key={selected?.id ?? "new"}
          listing={listing.data}
          initial={view === "edit" ? selected : null}
          initialContactId={params.get("contactId")}
          busy={busy}
          onSave={async (body) => {
            const saved = await command(body, "Draft saved. It stays private until you issue it.");
            if (saved) window.history.replaceState(null, "", `/admin/invoicing?view=invoice&id=${saved.id}`);
            return saved;
          }}
        />
      ) : view === "invoice" && selected ? (
        <InvoiceDetail invoice={selected} busy={busy} command={command} />
      ) : (
        <InvoiceList listing={listing.data} />
      )}
    </div>
  );
}

function InvoiceList({ listing }: { listing: Listing }) {
  const open = listing.invoices.filter((i) => i.status === "open" || i.status === "processing");
  const outstanding = open.reduce((sum, i) => sum + i.totalCents, 0);
  return (
    <AdminSurface padding="lg">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">All invoices</h2>
        <p className="admin-copy text-sm">
          {listing.stripe.testMode ? "Stripe test mode · " : ""}
          {open.length} awaiting payment · {invoiceMoney(outstanding)} outstanding
        </p>
      </div>
      {!listing.stripe.canTakePayments && (
        <p className="mt-4 rounded-xl bg-[var(--admin-warning-soft)] p-4 text-sm">
          Add your Stripe publishable key and webhook signing secret in Integrations so customers can
          pay online and invoices update to Paid automatically.
        </p>
      )}
      {listing.invoices.length === 0 ? (
        <p className="admin-copy mt-6 text-sm">
          No invoices yet. Choose New invoice to bill a customer.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[var(--admin-muted)]">
              <tr>
                <th className="py-2 font-medium">Invoice</th>
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 text-right font-medium">Amount</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {listing.invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-[var(--admin-border)]">
                  <td className="py-3">
                    <AdminLink
                      className="font-medium underline-offset-4 hover:underline"
                      href={`/admin/invoicing?view=invoice&id=${invoice.id}`}
                    >
                      {invoice.number ?? "Draft"}
                    </AdminLink>
                  </td>
                  <td className="py-3">
                    {invoice.customerName}
                    <span className="block text-xs text-[var(--admin-muted)]">
                      {invoice.customerEmail}
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {invoiceMoney(invoice.totalCents)}
                  </td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${statusTone[invoice.status] ?? "bg-[var(--admin-surface-subtle)]"}`}>
                      {invoiceStatusLabels[invoice.status]}
                    </span>
                  </td>
                  <td className="py-3">{date(invoice.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminSurface>
  );
}

function InvoiceForm({
  listing,
  initial,
  initialContactId,
  busy,
  onSave,
}: {
  listing: Listing;
  initial: InvoiceRecord | null;
  initialContactId: string | null;
  busy: boolean;
  onSave: (body: InvoiceCommand) => Promise<InvoiceRecord | null>;
}) {
  const preset = listing.contacts.find((c) => c.id === (initial?.contactId ?? initialContactId));
  const [contactId, setContactId] = useState(preset?.id ?? "");
  const [name, setName] = useState(initial?.customerName ?? preset?.full_name ?? "");
  const [email, setEmail] = useState(initial?.customerEmail ?? preset?.primary_email ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [methods, setMethods] = useState<InvoicePaymentMethod[]>(
    initial?.paymentMethods ?? ["us_bank_account", "card"],
  );
  const [lines, setLines] = useState<LineInput[]>(
    initial?.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      amount: (line.unitCents / 100).toFixed(2),
    })) ?? [{ description: "", quantity: 1, amount: "" }],
  );
  const [formError, setFormError] = useState("");
  let total: number | null = null;
  try {
    total = invoiceTotal(lines.map((l) => ({ quantity: l.quantity, unitCents: parseDollars(l.amount) })));
  } catch {
    total = null;
  }
  function chooseContact(value: string) {
    setContactId(value);
    const contact = listing.contacts.find((c) => c.id === value);
    if (contact) {
      setName(contact.full_name);
      setEmail(contact.primary_email);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    let parsed;
    try {
      parsed = lines.map((line) => ({
        description: line.description.trim(),
        quantity: line.quantity,
        unitCents: parseDollars(line.amount),
      }));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Check the line amounts");
      return;
    }
    void onSave({
      operation: "save_draft",
      id: initial?.id ?? null,
      revision: initial?.revision ?? null,
      draft: {
        contactId: contactId || null,
        customerName: name.trim(),
        customerEmail: email.trim(),
        lines: parsed,
        memo: memo.trim(),
        dueDate: dueDate || null,
        paymentMethods: methods,
      },
    });
  }
  return (
    <AdminSurface padding="lg">
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Who is this invoice for?</legend>
          <div>
            <label className="text-sm font-medium" htmlFor="invoice-contact">
              Contact (optional)
            </label>
            <select
              id="invoice-contact"
              className={field}
              value={contactId}
              onChange={(e) => chooseContact(e.target.value)}
            >
              <option value="">Not linked to a contact</option>
              {listing.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name} · {contact.primary_email}
                </option>
              ))}
            </select>
            <p className="admin-copy mt-1 text-xs">Linking a contact lets Collections follow up if it goes overdue.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="invoice-name">
                Bill to
              </label>
              <input id="invoice-name" className={field} required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="invoice-email">
                Billing email
              </label>
              <input id="invoice-email" type="email" className={field} required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold">What is it for?</legend>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_6rem_9rem_auto] sm:items-end">
              <div>
                <label className="text-sm font-medium" htmlFor={`line-${index}-description`}>
                  Description
                </label>
                <input
                  id={`line-${index}-description`}
                  className={field}
                  required
                  maxLength={240}
                  value={line.description}
                  onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, description: e.target.value } : l)))}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor={`line-${index}-quantity`}>
                  Quantity
                </label>
                <input
                  id={`line-${index}-quantity`}
                  type="number"
                  min={1}
                  max={10000}
                  className={field}
                  required
                  value={line.quantity}
                  onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, quantity: Number(e.target.value) || 1 } : l)))}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor={`line-${index}-amount`}>
                  Price (USD)
                </label>
                <input
                  id={`line-${index}-amount`}
                  inputMode="decimal"
                  placeholder="2000.00"
                  className={field}
                  required
                  value={line.amount}
                  onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, amount: e.target.value } : l)))}
                />
              </div>
              <button
                type="button"
                className={button}
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
                aria-label={`Remove line ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className={button}
              disabled={lines.length >= 20}
              onClick={() => setLines([...lines, { description: "", quantity: 1, amount: "" }])}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add line
            </button>
            <p className="text-lg font-semibold tabular-nums">
              Total {total === null ? "—" : invoiceMoney(total)}
            </p>
          </div>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Terms and payment</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="invoice-due">
                Due date (optional)
              </label>
              <input id="invoice-due" type="date" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">The customer can pay by</p>
            <div className="mt-2 flex flex-wrap gap-4">
              {INVOICE_PAYMENT_METHODS.map((method) => (
                <label key={method} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={methods.includes(method)}
                    onChange={(e) =>
                      setMethods(e.target.checked ? [...methods, method] : methods.filter((m) => m !== method))
                    }
                  />
                  {invoicePaymentMethodLabels[method]}
                </label>
              ))}
            </div>
            <p className="admin-copy mt-1 text-xs">
              Stripe charges 0.8% (at most $5) for a bank transfer and its card rate for a card. There is no invoice fee.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="invoice-memo">
              Note to the customer (optional)
            </label>
            <textarea id="invoice-memo" rows={3} maxLength={1000} className={field} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </fieldset>
        {formError && (
          <p role="alert" className="text-sm text-[var(--admin-danger)]">
            {formError}
          </p>
        )}
        <button type="submit" className={primary} disabled={busy || methods.length === 0}>
          {busy ? "Saving…" : "Save draft"}
        </button>
      </form>
    </AdminSurface>
  );
}

function InvoiceDetail({
  invoice,
  busy,
  command,
}: {
  invoice: InvoiceRecord;
  busy: boolean;
  command: (body: InvoiceCommand, success: string) => Promise<InvoiceRecord | null>;
}) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const shareUrl = invoice.shareUrl ? new URL(invoice.shareUrl, window.location.origin).toString() : null;
  const closable = invoice.status === "draft" || invoice.status === "open";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <AdminSurface padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--admin-muted)]">Bill to</p>
            <p className="font-semibold">{invoice.customerName}</p>
            <p className="text-sm">{invoice.customerEmail}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm ${statusTone[invoice.status] ?? "bg-[var(--admin-surface-subtle)]"}`}>
            {invoiceStatusLabels[invoice.status]}
            {invoice.testMode ? " · Test" : ""}
          </span>
        </div>
        <table className="mt-6 w-full text-sm">
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index} className="border-t border-[var(--admin-border)]">
                <td className="py-3">
                  {line.description}
                  {line.quantity > 1 && (
                    <span className="text-[var(--admin-muted)]"> · {line.quantity} × {invoiceMoney(line.unitCents)}</span>
                  )}
                </td>
                <td className="py-3 text-right tabular-nums">{invoiceMoney(line.quantity * line.unitCents)}</td>
              </tr>
            ))}
            <tr className="border-t border-[var(--admin-border)] text-base font-semibold">
              <td className="py-3">Total</td>
              <td className="py-3 text-right tabular-nums">{invoiceMoney(invoice.totalCents)}</td>
            </tr>
          </tbody>
        </table>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[var(--admin-muted)]">Due</dt><dd>{date(invoice.dueDate)}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Customer can pay by</dt><dd>{invoice.paymentMethods.map((m) => invoicePaymentMethodLabels[m]).join(", ")}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Issued</dt><dd>{date(invoice.issuedAt)}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Paid</dt><dd>{date(invoice.paidAt)}{invoice.refundedCents > 0 ? ` · ${invoiceMoney(invoice.refundedCents)} refunded` : ""}</dd></div>
          {invoice.externalPaymentNote && (
            <div className="sm:col-span-2"><dt className="text-[var(--admin-muted)]">Outside payment</dt><dd>{invoice.externalPaymentNote}</dd></div>
          )}
          {invoice.memo && (
            <div className="sm:col-span-2"><dt className="text-[var(--admin-muted)]">Note to the customer</dt><dd className="whitespace-pre-line">{invoice.memo}</dd></div>
          )}
        </dl>
      </AdminSurface>
      <div className="space-y-4">
        {invoice.status === "draft" ? (
          <AdminSurface padding="lg" className="space-y-3">
            <h2 className="font-semibold">Ready to send?</h2>
            <p className="admin-copy text-sm">
              Issuing assigns the invoice number and creates the customer payment link. Nothing is emailed.
            </p>
            <button
              type="button"
              className={`${primary} w-full`}
              disabled={busy}
              onClick={() =>
                void command(
                  { operation: "issue", id: invoice.id, revision: invoice.revision },
                  "Invoice issued. Copy the link and send it to your customer.",
                )
              }
            >
              <ReceiptText className="size-4" aria-hidden="true" />
              Issue invoice
            </button>
            <AdminLink className={`${button} w-full`} href={`/admin/invoicing?view=edit&id=${invoice.id}`}>
              Edit draft
            </AdminLink>
          </AdminSurface>
        ) : shareUrl ? (
          <AdminSurface padding="lg" className="space-y-3">
            <h2 className="font-semibold">Customer link</h2>
            <p className="admin-copy break-all text-xs">{shareUrl}</p>
            <button
              type="button"
              className={`${primary} w-full`}
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl).then(() => setCopied(true));
              }}
            >
              <Copy className="size-4" aria-hidden="true" />
              {copied ? "Link copied" : "Copy link"}
            </button>
            <a className={`${button} w-full`} href={shareUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
              Open customer page
            </a>
          </AdminSurface>
        ) : null}
        {(invoice.status === "open" || invoice.status === "processing") && (
          <button
            type="button"
            className={`${button} w-full`}
            disabled={busy}
            onClick={() =>
              void command({ operation: "refresh_payment", id: invoice.id }, "Payment status checked with Stripe.")
            }
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Check payment status
          </button>
        )}
        {invoice.status === "open" && (
          <AdminSurface padding="lg" className="space-y-3">
            <h2 className="font-semibold">Paid another way?</h2>
            <label className="text-sm font-medium" htmlFor="external-note">
              How it was paid
            </label>
            <input
              id="external-note"
              className={field}
              maxLength={300}
              placeholder="Check #1042 received Dec 2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              className={`${button} w-full`}
              disabled={busy || !note.trim()}
              onClick={() =>
                void command(
                  { operation: "record_external_payment", id: invoice.id, revision: invoice.revision, note },
                  "Recorded as paid outside Stripe. The online payment was cancelled.",
                )
              }
            >
              Mark as paid
            </button>
          </AdminSurface>
        )}
        {closable && (
          <button
            type="button"
            className={`${button} w-full`}
            disabled={busy}
            onClick={() => {
              if (window.confirm("Void this invoice? The customer link stops working and the online payment is cancelled."))
                void command({ operation: "void", id: invoice.id, revision: invoice.revision }, "Invoice voided.");
            }}
          >
            Void invoice
          </button>
        )}
      </div>
    </div>
  );
}

function StripeConnection({ onConnected }: { onConnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) || "").trim();
    setBusy(true);
    setError("");
    void fetchJson("/api/admin/tenant/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "configure_stripe",
        apiKey: value("apiKey"),
        accountId: value("accountId"),
        ...(value("publishableKey") ? { publishableKey: value("publishableKey") } : {}),
        ...(value("webhookSecret") ? { webhookSecret: value("webhookSecret") } : {}),
      }),
    })
      .then(onConnected)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Stripe could not be connected"))
      .finally(() => setBusy(false));
  }
  return (
    <AdminSurface padding="lg">
      <h2 className="text-lg font-semibold">Connect your Stripe account</h2>
      <p className="admin-copy mt-2 max-w-2xl text-sm leading-6">
        Stripe only processes the payments. Use a restricted key with write access to Payment
        Intents and Refunds and read access to Charges and Customers. The key stays encrypted in
        this workspace.
      </p>
      <form onSubmit={connect} className="mt-5 max-w-xl space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="stripe-account-id">Stripe account ID</label>
          <input id="stripe-account-id" name="accountId" className={field} required pattern="acct_[A-Za-z0-9]+" placeholder="acct_…" autoComplete="off" />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="stripe-key">Secret or restricted key</label>
          <input id="stripe-key" name="apiKey" type="password" autoComplete="new-password" className={field} required minLength={20} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="stripe-publishable-key">Publishable key</label>
          <input id="stripe-publishable-key" name="publishableKey" className={field} autoComplete="off" placeholder="pk_live_… or pk_test_…" required />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="stripe-webhook-secret">Webhook signing secret</label>
          <input id="stripe-webhook-secret" name="webhookSecret" type="password" autoComplete="new-password" className={field} minLength={10} required />
        </div>
        {error && <p role="alert" className="text-sm text-[var(--admin-danger)]">{error}</p>}
        <button type="submit" className={primary} disabled={busy}>
          {busy ? "Connecting…" : "Connect Stripe"}
        </button>
      </form>
    </AdminSurface>
  );
}
