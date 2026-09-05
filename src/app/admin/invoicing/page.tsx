"use client";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ReceiptText, RefreshCw, Send, Trash2 } from "lucide-react";
import { InvoicePageDesigner } from "@/components/admin/InvoicePageDesigner";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import AdminLink from "@/components/admin/AdminLink";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import type { WorkflowPreview } from "@/lib/revenue-os/workflow-plugins";
import type { StripeInvoiceReceipt } from "@/lib/revenue-os/stripe-contract";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50";
const primary = button + " bg-[var(--admin-ink)] text-[var(--admin-surface)]";
const field =
  "mt-2 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-ink)]";
type Action = {
  id: string;
  action_type: string;
  title: string;
  description: string;
  status: string;
  error: string | null;
  result: StripeInvoiceReceipt | null;
  payload: Record<string, unknown>;
};
type Billing = {
  testMode: boolean;
  truncated: boolean;
  contacts: { id: string; full_name: string; primary_email: string }[];
  customers: { id: string; name: string | null; email: string | null }[];
  actions: Action[];
};
type Line = { description: string; quantity: number; amount: string };
function minorUnits(value: string) {
  const match = value.trim().match(/^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Enter amounts with at most two decimal places");
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
}
export default function InvoicingPage() {
  const [designAction, setDesignAction] = useState<string | null>(null);
  const demo = useAdminDemo();
  const cache = useQueryClient();
  const providers = useAdminQuery<{ providers: { provider: string; status: string }[] }>(
    ["tenant", "providers"],
    "/api/admin/tenant/providers",
    { enabled: !demo },
  );
  const connected =
    providers.data?.providers.some(
      (provider) => provider.provider === "stripe" && provider.status === "connected",
    ) ?? false;
  const [contactSearch, setContactSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contactId, setContactId] = useState("");
  const billing = useAdminQuery<Billing>(
    ["admin", "invoicing", appliedSearch, contactId],
    `/api/admin/invoicing?${new URLSearchParams({ search: appliedSearch, ...(contactId ? { contactId } : {}) })}`,
    { enabled: connected && !demo },
  );
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState("usd");
  const [days, setDays] = useState(14);
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: 1, amount: "" }]);
  const [preview, setPreview] = useState<WorkflowPreview | null>(null);
  const [preparedInput, setPreparedInput] = useState<Record<string, unknown> | null>(null);
  const [requestId, setRequestId] = useState("");
  const [liveReceipts, setLiveReceipts] = useState<Record<string, StripeInvoiceReceipt>>({});
  function edit() {
    setPreview(null);
    setPreparedInput(null);
    setNotice("");
  }
  async function perform(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invoice operation failed");
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ["admin", "invoicing"] });
    await cache.invalidateQueries({ queryKey: ["admin", "actions"] });
  }
  function connect(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      await fetchJson("/api/admin/tenant/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "configure_stripe", apiKey }),
      });
      setApiKey("");
      await cache.invalidateQueries({ queryKey: ["tenant", "providers"] });
      setNotice("Stripe connected for this workspace.");
    });
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      const input = {
        contactId,
        customerId,
        currency,
        daysUntilDue: days,
        memo,
        lines: lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitAmount: minorUnits(line.amount),
        })),
      };
      const result = await fetchJson<WorkflowPreview>("/api/admin/plugins/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId: "stripe-invoicing", mode: "preview", input }),
      });
      setPreview(result);
      setPreparedInput(input);
      setRequestId(crypto.randomUUID());
    });
  }
  function requestApproval() {
    void perform(async () => {
      if (!preview || !preparedInput) throw new Error("Prepare the invoice first");
      await fetchJson("/api/admin/plugins/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "stripe-invoicing",
          mode: "propose",
          input: preparedInput,
          digest: preview.digest,
          requestId,
        }),
      });
      setPreview(null);
      setNotice(
        "Invoice draft is ready for approval below. Nothing has been created in Stripe yet.",
      );
      await refresh();
    });
  }
  function decide(id: string, decision: "approve" | "reject" | "retry") {
    void perform(async () => {
      try {
        await fetchJson("/api/admin/revenue-os/actions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, decision }),
        });
        setNotice(
          decision === "retry"
            ? "The same operation is ready for review again."
            : decision === "reject"
              ? "Invoice action rejected."
              : "Invoice action completed. Inspect its receipt below.",
        );
      } finally {
        await refresh();
      }
    });
  }
  const currentContact = billing.data?.contacts.find((contact) => contact.id === contactId);
  const matchingCustomers =
    billing.data?.customers.filter(
      (customer) => customer.email?.toLowerCase() === currentContact?.primary_email?.toLowerCase(),
    ) ?? [];
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Invoicing"
        subtitle="From customer agreement to a reviewed invoice and a clear payment status."
        actions={
          <AdminLink href="/admin/plugins" className={button}>
            Manage plugins
          </AdminLink>
        }
      />
      {demo ? (
        <AdminSurface padding="lg">
          <h2 className="font-semibold">Connected invoicing</h2>
          <p className="admin-copy mt-2">
            This fictional workspace does not connect to Stripe or issue billing documents.
          </p>
        </AdminSurface>
      ) : (
        <>
          {(error || providers.error || billing.error) && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm"
            >
              {error || providers.error?.message || billing.error?.message}
              <button className={`${button} ml-2`} onClick={() => void refresh()} type="button">
                Refresh invoices
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm">
              {notice}
            </p>
          )}
          {!connected ? (
            <AdminSurface padding="lg">
              <div className="flex items-start gap-3">
                <ReceiptText className="mt-1 size-6 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="text-lg font-semibold">Connect your Stripe account</h2>
                  <p className="admin-copy mt-2 max-w-2xl text-sm leading-6">
                    Use a restricted key with account and customer read access and invoice write
                    access. The key stays encrypted in this workspace. Start with a test key to
                    exercise the full workflow without sending customer emails.
                  </p>
                </div>
              </div>
              <form onSubmit={connect} className="mt-5 max-w-xl">
                <label className="text-sm font-medium" htmlFor="stripe-key">
                  Stripe API key
                </label>
                <input
                  id="stripe-key"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className={field}
                  required
                  minLength={20}
                />
                <button
                  type="submit"
                  className={`${primary} mt-4`}
                  disabled={busy || providers.isPending}
                >
                  Connect Stripe
                </button>
              </form>
            </AdminSurface>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="admin-copy text-sm">
                  {billing.data?.testMode
                    ? "Test mode · Stripe invoice emails are not delivered."
                    : billing.data
                      ? "Live mode · Approved sending requests a real customer email."
                      : "Loading billing workspace…"}
                </p>
                <button
                  type="button"
                  className={button}
                  disabled={busy || billing.isFetching}
                  onClick={() => void refresh()}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Refresh history
                </button>
              </div>
              <details className="rounded-xl border border-[var(--admin-border)] px-4 py-2">
                <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium">
                  Stripe connection settings
                </summary>
                <p className="admin-copy mt-2 max-w-2xl text-sm leading-6">
                  Replace the workspace key when rotating credentials. Disconnecting pauses invoice
                  work and customer pages; recorded operations remain available in the platform
                  history.
                </p>
                <form onSubmit={connect} className="my-4 max-w-xl">
                  <label className="text-sm font-medium" htmlFor="stripe-replacement-key">
                    Replacement Stripe key
                  </label>
                  <input
                    id="stripe-replacement-key"
                    type="password"
                    autoComplete="new-password"
                    className={field}
                    required
                    minLength={20}
                    value={apiKey}
                    disabled={busy}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <button type="submit" className={`${button} mt-3`} disabled={busy}>
                    Verify & replace key
                  </button>
                </form>
                <button
                  type="button"
                  className={`${button} mb-3`}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await fetchJson("/api/admin/tenant/providers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "disconnect", provider: "stripe" }),
                      });
                      await providers.refetch();
                      setApiKey("");
                      setNotice("Stripe disconnected for this workspace.");
                    })
                  }
                >
                  Disconnect Stripe
                </button>
              </details>
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
                <AdminSurface padding="lg">
                  <h2 className="text-lg font-semibold">New customer invoice</h2>
                  <p className="admin-copy mt-2 text-sm">
                    Match a CRM contact to an existing Stripe billing customer. Prepare the draft
                    before approving any external action.
                  </p>
                  <div className="mt-5 flex items-end gap-3">
                    <label className="min-w-0 flex-1 text-sm font-medium">
                      Find CRM customer
                      <input
                        className={field}
                        type="search"
                        disabled={busy}
                        maxLength={100}
                        value={contactSearch}
                        onChange={(event) => setContactSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            edit();
                            setAppliedSearch(contactSearch.trim());
                            setContactId("");
                            setCustomerId("");
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => {
                        edit();
                        setAppliedSearch(contactSearch.trim());
                        setContactId("");
                        setCustomerId("");
                      }}
                    >
                      Search
                    </button>
                  </div>
                  <form onSubmit={prepare} className="mt-5">
                    <fieldset disabled={busy} className="space-y-5">
                      <legend className="sr-only">Invoice details</legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium">
                          CRM customer
                          <select
                            className={field}
                            aria-label="CRM customer"
                            value={contactId}
                            required
                            onChange={(event) => {
                              edit();
                              setContactId(event.target.value);
                              setCustomerId("");
                            }}
                          >
                            <option value="">Choose a contact</option>
                            {billing.data?.contacts.map((contact) => (
                              <option value={contact.id} key={contact.id}>
                                {contact.full_name} · {contact.primary_email}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm font-medium">
                          Stripe billing customer
                          <select
                            className={field}
                            aria-label="Stripe billing customer"
                            value={customerId}
                            required
                            disabled={!contactId}
                            onChange={(event) => {
                              edit();
                              setCustomerId(event.target.value);
                            }}
                          >
                            <option value="">Choose matching customer</option>
                            {matchingCustomers.map((customer) => (
                              <option value={customer.id} key={customer.id}>
                                {customer.name || customer.email}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {contactId && !matchingCustomers.length && (
                        <p className="admin-copy text-sm">
                          No Stripe customer matches this CRM billing email. Add or correct the
                          customer in Stripe, then refresh. CRM and Stripe emails must match.
                        </p>
                      )}
                      {billing.data?.truncated && (
                        <p className="admin-copy text-xs">
                          Refine the customer name search if needed: up to 100 CRM matches are
                          shown. Stripe billing choices are filtered by the selected contact’s
                          email.
                        </p>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium">
                          Currency
                          <select
                            className={field}
                            value={currency}
                            onChange={(event) => {
                              edit();
                              setCurrency(event.target.value);
                            }}
                          >
                            {["usd", "eur", "gbp", "cad", "aud"].map((value) => (
                              <option key={value} value={value}>
                                {value.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm font-medium">
                          Payment terms (days)
                          <input
                            type="number"
                            min={1}
                            max={90}
                            required
                            className={field}
                            value={days}
                            onChange={(event) => {
                              edit();
                              setDays(Number(event.target.value));
                            }}
                          />
                        </label>
                      </div>
                      <fieldset className="space-y-4">
                        <legend className="mb-3 text-sm font-semibold">Line items</legend>
                        {lines.map((line, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-[var(--admin-border)] p-4"
                          >
                            <label className="text-xs font-medium">
                              Description
                              <input
                                aria-label={`Line ${index + 1} description`}
                                className={field}
                                value={line.description}
                                required
                                maxLength={200}
                                onChange={(event) => {
                                  edit();
                                  setLines(
                                    lines.map((item, i) =>
                                      i === index
                                        ? { ...item, description: event.target.value }
                                        : item,
                                    ),
                                  );
                                }}
                              />
                            </label>
                            <div className="mt-3 grid grid-cols-[1fr_1.3fr_auto] items-end gap-3">
                              <label className="min-w-0 text-xs font-medium">
                                Quantity
                                <input
                                  aria-label={`Line ${index + 1} quantity`}
                                  className={`${field} tabular-nums`}
                                  type="number"
                                  min={1}
                                  max={10000}
                                  required
                                  value={line.quantity}
                                  onChange={(event) => {
                                    edit();
                                    setLines(
                                      lines.map((item, i) =>
                                        i === index
                                          ? { ...item, quantity: Number(event.target.value) }
                                          : item,
                                      ),
                                    );
                                  }}
                                />
                              </label>
                              <label className="min-w-0 text-xs font-medium">
                                Unit price ({currency.toUpperCase()})
                                <input
                                  aria-label={`Line ${index + 1} unit price`}
                                  className={`${field} tabular-nums`}
                                  inputMode="decimal"
                                  value={line.amount}
                                  required
                                  onChange={(event) => {
                                    edit();
                                    setLines(
                                      lines.map((item, i) =>
                                        i === index
                                          ? { ...item, amount: event.target.value }
                                          : item,
                                      ),
                                    );
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                className={button}
                                aria-label={`Remove line ${index + 1}`}
                                disabled={lines.length === 1 || busy}
                                onClick={() => {
                                  edit();
                                  setLines(lines.filter((_, i) => i !== index));
                                }}
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className={button}
                          disabled={lines.length >= 10 || busy}
                          onClick={() => {
                            edit();
                            setLines([...lines, { description: "", quantity: 1, amount: "" }]);
                          }}
                        >
                          <Plus aria-hidden="true" className="size-4" />
                          Add line item
                        </button>
                      </fieldset>
                      <label className="block text-sm font-medium">
                        Invoice memo
                        <textarea
                          className={field}
                          rows={3}
                          maxLength={500}
                          value={memo}
                          onChange={(event) => {
                            edit();
                            setMemo(event.target.value);
                          }}
                        />
                      </label>
                      <p className="admin-copy text-xs leading-5">
                        Amounts exclude taxes and discounts. Review account tax requirements before
                        sending; this workflow does not configure automatic tax or charge a saved
                        payment method.
                      </p>
                      <button type="submit" className={primary} disabled={busy || !billing.data}>
                        Prepare invoice
                      </button>
                    </fieldset>
                  </form>
                </AdminSurface>
                <AdminSurface padding="lg">
                  <p className="admin-eyebrow">Review before action</p>
                  <h2 className="mt-2 text-lg font-semibold">
                    {preview ? preview.title : "Your invoice preview"}
                  </h2>
                  {preview ? (
                    <>
                      <p className="admin-copy mt-3 text-sm leading-6">{preview.summary}</p>
                      <p className="mt-4 text-3xl font-semibold tabular-nums">
                        {money(Number(preview.payload.total), String(preview.payload.currency))}
                      </p>
                      <button
                        className={`${primary} mt-5`}
                        disabled={busy}
                        onClick={requestApproval}
                        type="button"
                      >
                        Request draft approval
                      </button>
                      <p className="admin-copy mt-3 text-xs">
                        The approval below creates the Stripe draft. Sending remains a separate
                        decision.
                      </p>
                    </>
                  ) : (
                    <p className="admin-copy mt-3 text-sm leading-6">
                      Select the customer and line items, then prepare an exact invoice for review.
                    </p>
                  )}
                </AdminSurface>
              </div>
              {designAction && (
                <InvoicePageDesigner
                  key={designAction}
                  creationActionId={designAction}
                  onClose={() => setDesignAction(null)}
                  onProposed={refresh}
                />
              )}
              <AdminSurface padding="lg">
                <h2 className="text-lg font-semibold">Invoice operations</h2>
                <p className="admin-copy mt-2 text-sm">
                  Approvals, provider results, and recoverable failures stay together.
                </p>
                {!billing.data?.actions.length && (
                  <p className="admin-copy mt-5 text-sm">
                    No invoice operations yet. Prepare your first customer invoice above.
                  </p>
                )}
                <div className="mt-5 space-y-5">
                  {billing.data?.actions.map((action) => {
                    const result = liveReceipts[action.id] ?? action.result;
                    return (
                      <article
                        key={action.id}
                        className="rounded-xl border border-[var(--admin-border)] p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <h3 className="font-semibold">{action.title}</h3>
                          <span className="text-xs font-medium">{action.status}</span>
                        </div>
                        <p className="admin-copy mt-2 text-sm leading-6">{action.description}</p>
                        {action.error && (
                          <p className="mt-3 text-sm" role="alert">
                            {action.error}
                          </p>
                        )}
                        {result?.invoiceId && (
                          <div className="mt-3 space-y-1 text-sm">
                            <p className="font-medium tabular-nums">
                              {money(result.amountRemaining, result.currency)} outstanding ·{" "}
                              {money(result.amountPaid, result.currency)} paid · {result.status}
                            </p>
                            <p className="admin-copy text-xs">
                              {result.complete
                                ? "Recorded provider result"
                                : "Partial operation: inspect this invoice before recovery"}{" "}
                              · {result.invoiceId}
                            </p>
                            {result.delivery === "not_sent_test_mode" && (
                              <p className="text-xs">
                                Stripe accepted the test request. No customer email was sent.
                              </p>
                            )}
                            {result.delivery === "requested" && (
                              <p className="text-xs">
                                Stripe accepted the sending request. This is not proof of email
                                delivery.
                              </p>
                            )}
                            {result.hostedInvoiceUrl && (
                              <a
                                className="inline-flex min-h-10 items-center underline"
                                href={result.hostedInvoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open hosted invoice
                              </a>
                            )}
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {action.status === "pending" && (
                            <>
                              <button
                                className={primary}
                                disabled={busy}
                                onClick={() => decide(action.id, "approve")}
                                type="button"
                              >
                                {action.action_type === "send_stripe_invoice"
                                  ? "Approve & send invoice"
                                  : action.action_type === "publish_invoice_page"
                                    ? "Approve & publish page"
                                    : "Approve & create draft"}
                              </button>
                              <button
                                className={button}
                                disabled={busy}
                                onClick={() => decide(action.id, "reject")}
                                type="button"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {action.status === "failed" && (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => decide(action.id, "retry")}
                              type="button"
                            >
                              Retry same operation for review
                            </button>
                          )}
                          {action.action_type === "create_stripe_invoice_draft" &&
                            result?.invoiceId && (
                              <>
                                <button
                                  type="button"
                                  className={button}
                                  disabled={busy}
                                  onClick={() =>
                                    void perform(async () => {
                                      const receipt = await fetchJson<StripeInvoiceReceipt>(
                                        `/api/admin/invoicing?actionId=${encodeURIComponent(action.id)}`,
                                      );
                                      setLiveReceipts((previous) => ({
                                        ...previous,
                                        [action.id]: receipt,
                                      }));
                                    })
                                  }
                                >
                                  Check payment status
                                </button>
                                {action.status === "executed" && (
                                  <button
                                    type="button"
                                    className={button}
                                    disabled={busy}
                                    onClick={() => setDesignAction(action.id)}
                                  >
                                    Design customer page
                                  </button>
                                )}
                                {action.status === "executed" &&
                                  ["draft", "open"].includes(result.status) && (
                                    <button
                                      type="button"
                                      className={button}
                                      disabled={busy}
                                      onClick={() =>
                                        void perform(async () => {
                                          await fetchJson("/api/admin/invoicing", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ creationActionId: action.id }),
                                          });
                                          setNotice("Sending request is ready for review below.");
                                          await refresh();
                                        })
                                      }
                                    >
                                      <Send className="size-4" aria-hidden="true" />
                                      Request sending approval
                                    </button>
                                  )}
                              </>
                            )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </AdminSurface>
            </>
          )}
        </>
      )}
    </div>
  );
}
