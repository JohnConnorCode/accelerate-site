"use client";
import { useId, type ReactNode } from "react";
import { serviceDateInput, serviceDateLabel } from "@/lib/invoices/service-dates";
import {
  INVOICE_PAYMENT_METHODS,
  invoiceKinds,
  invoicePaymentMethodLabels,
  invoiceSubtotal,
  money,
  type InvoiceDraft,
} from "@/lib/invoices/schema";

export type InvoiceFieldIssue = { field: string; message: string };
export type InvoiceContact = { id: string; full_name: string; primary_email: string };

// Ported from SuperDebate's invoice editor, on Accelerate's admin field styles.
const input = "admin-field w-full min-w-0";
const radio =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--admin-border)] px-3 py-3 text-sm has-[:checked]:border-[var(--admin-ink,#111)] has-[:checked]:bg-[var(--admin-surface-subtle)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

function Field({
  name,
  title,
  issues,
  children,
  wide = false,
  help,
  className = "",
}: {
  name: string;
  title: string;
  issues: InvoiceFieldIssue[];
  children: ReactNode;
  wide?: boolean;
  help?: string;
  className?: string;
}) {
  const error = issues.find((i) => i.field === name);
  return (
    <div className={`grid min-w-0 gap-2 self-start ${wide ? "sm:col-span-2" : ""} ${className}`}>
      <label htmlFor={"invoice-field-" + name} className="text-sm font-medium">
        {title}
      </label>
      {children}
      {error ? (
        <p id={"invoice-error-" + name} className="text-sm text-[var(--admin-danger)]">
          {error.message}
        </p>
      ) : (
        help && <p className="text-xs text-[var(--admin-muted)]">{help}</p>
      )}
    </div>
  );
}

export function InvoiceEditorFields({
  draft,
  set,
  issues,
  contacts,
  disabled,
}: {
  draft: InvoiceDraft;
  set: <K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) => void;
  issues: InvoiceFieldIssue[];
  contacts: InvoiceContact[];
  disabled: boolean;
}) {
  const formId = useId();
  type TextKey =
    | "company_name"
    | "contact_name"
    | "contact_email"
    | "description"
    | "discount_label"
    | "billing_line1"
    | "billing_line2"
    | "billing_city"
    | "billing_region"
    | "billing_postal"
    | "purchase_order";
  const text = (
    key: TextKey,
    title: string,
    placeholder = "",
    wide = false,
    type = "text",
    help?: string,
  ) => (
    <Field key={key} name={key} title={title} issues={issues} wide={wide} help={help}>
      <input
        id={"invoice-field-" + key}
        aria-invalid={issues.some((i) => i.field === key)}
        className={input}
        type={type}
        value={String(draft[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
  const subtotal = invoiceSubtotal(draft.lines);
  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-5 sm:grid-cols-2">
      <fieldset className="min-w-0 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Invoice type</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(invoiceKinds).map(([value, title]) => (
            <label key={value} className={radio}>
              <input
                type="radio"
                name={formId + "kind"}
                checked={draft.kind === value}
                onChange={() => set("kind", value as InvoiceDraft["kind"])}
              />
              {title}
            </label>
          ))}
        </div>
      </fieldset>
      <h3 className="border-t border-[var(--admin-border)] pt-4 text-base font-semibold sm:col-span-2">
        Client details
      </h3>
      <Field
        name="contact_id"
        title="Saved contact (optional)"
        issues={issues}
        wide
        help="Choosing a contact fills the details below. Linked invoices can be followed up in Collections."
      >
        <select
          id="invoice-field-contact_id"
          className={input}
          value={draft.contact_id ?? ""}
          onChange={(e) => {
            const contact = contacts.find((c) => c.id === e.target.value);
            set("contact_id", contact?.id ?? null);
            if (contact) {
              if (!draft.company_name) set("company_name", contact.full_name);
              set("contact_name", contact.full_name);
              set("contact_email", contact.primary_email);
            }
          }}
        >
          <option value="">Not linked to a contact</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.full_name} · {contact.primary_email}
            </option>
          ))}
        </select>
      </Field>
      {text("company_name", "Client name", "Organization or individual")}
      {text("contact_name", "Contact name", "Billing contact")}
      {text(
        "contact_email",
        "Client email",
        "billing@example.com",
        true,
        "email",
        "Used for the billing record and the payment receipt.",
      )}
      <Field
        name="service_period"
        title="Service date (optional)"
        issues={issues}
        wide
        help="Shown on the invoice under the first line item. Enter a range below if it spans several days."
      >
        <input
          id="invoice-field-service_period"
          className={input}
          type="date"
          value={serviceDateInput(draft.service_period)}
          onChange={(e) => set("service_period", serviceDateLabel(e.target.value))}
        />
        <details
          className="min-w-0"
          open={Boolean(draft.service_period && !serviceDateInput(draft.service_period))}
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-[var(--admin-muted)]">
            Enter a date range or custom period
          </summary>
          <input
            aria-label="Service dates"
            className={input}
            value={draft.service_period}
            onChange={(e) => set("service_period", e.target.value)}
            placeholder="For example, December 1–31, 2026"
          />
        </details>
      </Field>
      <h3 className="border-t border-[var(--admin-border)] pt-4 text-base font-semibold sm:col-span-2">
        Agreement and pricing
      </h3>
      {text("description", "Invoice description", "Services or agreement being invoiced", true)}
      <div id="invoice-field-lines" tabIndex={-1} className="min-w-0 space-y-3 sm:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium">Line items</h4>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            disabled={draft.lines.length >= 20}
            onClick={() =>
              set("lines", [...draft.lines, { description: "", quantity: 1, unit_cents: 0 }])
            }
          >
            Add item
          </button>
        </div>
        {draft.lines.map((line, index) => (
          <div
            key={index}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-3 rounded-xl bg-[var(--admin-surface-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_80px_130px_40px]"
          >
            <Field
              name={`lines.${index}.description`}
              title={`Item ${index + 1} description`}
              issues={issues}
              className="col-span-3 sm:col-span-1"
            >
              <input
                id={`invoice-field-lines.${index}.description`}
                className={input}
                value={line.description}
                placeholder="Service or deliverable"
                onChange={(e) =>
                  set(
                    "lines",
                    draft.lines.map((v, j) =>
                      j === index ? { ...v, description: e.target.value } : v,
                    ),
                  )
                }
              />
            </Field>
            <Field name={`lines.${index}.quantity`} title="Quantity" issues={issues}>
              <input
                id={`invoice-field-lines.${index}.quantity`}
                className={input}
                type="number"
                min="1"
                max="1000"
                value={line.quantity}
                onChange={(e) =>
                  set(
                    "lines",
                    draft.lines.map((v, j) =>
                      j === index ? { ...v, quantity: Number(e.target.value) } : v,
                    ),
                  )
                }
              />
            </Field>
            <Field name={`lines.${index}.unit_cents`} title="Rate ($)" issues={issues}>
              <input
                id={`invoice-field-lines.${index}.unit_cents`}
                className={input}
                type="number"
                min="0.01"
                step="0.01"
                value={line.unit_cents ? line.unit_cents / 100 : ""}
                placeholder="0.00"
                onChange={(e) =>
                  set(
                    "lines",
                    draft.lines.map((v, j) =>
                      j === index
                        ? { ...v, unit_cents: Math.round(Number(e.target.value) * 100) }
                        : v,
                    ),
                  )
                }
              />
            </Field>
            <button
              type="button"
              aria-label={`Remove item ${index + 1}`}
              className="min-h-11 self-end rounded-lg text-xl text-[var(--admin-muted)] hover:text-[var(--admin-danger)] disabled:opacity-40"
              disabled={draft.lines.length === 1}
              onClick={() =>
                set(
                  "lines",
                  draft.lines.filter((_, j) => j !== index),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <Field name="discount_cents" title="Discount ($, optional)" issues={issues}>
        <input
          id="invoice-field-discount_cents"
          className={input}
          type="number"
          min="0"
          step="0.01"
          value={draft.discount_cents ? draft.discount_cents / 100 : ""}
          placeholder="0.00"
          onChange={(e) => set("discount_cents", Math.round(Number(e.target.value) * 100))}
        />
      </Field>
      {text("discount_label", "Discount label", "Agreed discount")}
      <dl className="grid gap-3 rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm tabular-nums sm:col-span-2 sm:grid-cols-3">
        <div className="flex items-baseline justify-between gap-3 sm:block">
          <dt className="text-[var(--admin-muted)]">Full price</dt>
          <dd className="font-semibold whitespace-nowrap sm:mt-1">{money(subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:block">
          <dt className="text-[var(--admin-muted)]">Discount</dt>
          <dd className="font-semibold whitespace-nowrap sm:mt-1">
            −{money(draft.discount_cents)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--admin-border)] pt-3 sm:block sm:border-0 sm:pt-0">
          <dt>Amount due</dt>
          <dd className="font-semibold whitespace-nowrap sm:mt-1">
            {money(subtotal - draft.discount_cents)}
          </dd>
        </div>
      </dl>
      <h3 className="border-t border-[var(--admin-border)] pt-4 text-base font-semibold sm:col-span-2">
        Invoice dates and payment
      </h3>
      <Field
        name="invoice_date"
        title="Invoice date"
        issues={issues}
        help="Leave blank to use the day this invoice is issued."
      >
        <input
          id="invoice-field-invoice_date"
          className={input}
          type="date"
          value={draft.invoice_date || ""}
          onChange={(e) => set("invoice_date", e.target.value || null)}
        />
      </Field>
      <Field
        name="due_date"
        title="Payment due date"
        issues={issues}
        help="Choose an exact date, or leave blank to use the payment terms below."
      >
        <input
          id="invoice-field-due_date"
          className={input}
          type="date"
          min={draft.invoice_date || undefined}
          value={draft.due_date || ""}
          onChange={(e) => set("due_date", e.target.value || null)}
        />
      </Field>
      <Field
        name="due_days"
        title="Payment terms (days)"
        issues={issues}
        help={
          draft.due_date
            ? "The exact due date above overrides these days."
            : "Days from the invoice date. Zero means due upon receipt."
        }
      >
        <input
          id="invoice-field-due_days"
          className={input}
          type="number"
          min="0"
          max="365"
          value={draft.due_days}
          onChange={(e) => set("due_days", Number(e.target.value))}
        />
      </Field>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Tax treatment</legend>
        <div id="invoice-field-tax_review" tabIndex={-1} className="grid gap-2">
          {[
            ["no_tax", "No tax applied"],
            ["tax_included", "Tax included in rates"],
          ].map(([value, title]) => (
            <label key={value} className={radio}>
              <input
                type="radio"
                name={formId + "tax"}
                checked={draft.tax_review === value}
                onChange={() => set("tax_review", value as InvoiceDraft["tax_review"])}
              />
              {title}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="min-w-0 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">The client can pay by</legend>
        <div
          id="invoice-field-payment_methods"
          tabIndex={-1}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {INVOICE_PAYMENT_METHODS.map((method) => (
            <label key={method} className={radio}>
              <input
                type="checkbox"
                checked={draft.payment_methods.includes(method)}
                onChange={(e) =>
                  set(
                    "payment_methods",
                    e.target.checked
                      ? [...draft.payment_methods, method]
                      : draft.payment_methods.filter((m) => m !== method),
                  )
                }
              />
              {invoicePaymentMethodLabels[method]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--admin-muted)]">
          Stripe charges 0.8% (at most $5) for a bank transfer and its card rate for a card. There
          is no invoice fee.
        </p>
      </fieldset>
      <details className="rounded-xl border border-[var(--admin-border)] p-4 sm:col-span-2">
        <summary className="min-h-10 cursor-pointer text-sm font-medium">
          Billing address and references (optional)
        </summary>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          {text("billing_line1", "Billing street address", "Street and number")}
          {text("billing_line2", "Suite / unit")}
          {text("billing_city", "City")}
          {text("billing_region", "State or province")}
          {text("billing_postal", "ZIP / postal code")}
          <Field name="billing_country" title="Country code" issues={issues}>
            <input
              id="invoice-field-billing_country"
              className={input}
              maxLength={2}
              value={draft.billing_country}
              onChange={(e) => set("billing_country", e.target.value.toUpperCase())}
            />
          </Field>
          {text("purchase_order", "Purchase order")}
          <Field name="support_details" title="Agreement details" issues={issues} wide>
            <textarea
              id="invoice-field-support_details"
              rows={2}
              maxLength={240}
              className={input}
              value={draft.support_details}
              onChange={(e) => set("support_details", e.target.value)}
            />
          </Field>
          <Field name="notes" title="Additional invoice notes" issues={issues} wide>
            <textarea
              id="invoice-field-notes"
              rows={2}
              maxLength={500}
              className={input}
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
      </details>
    </fieldset>
  );
}
