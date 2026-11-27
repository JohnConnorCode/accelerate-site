import type { CommercialInvoice, InvoiceDraft } from "@/lib/invoices/schema";
import { formatBillingAddress, invoiceKinds, money } from "@/lib/invoices/schema";
import { invoiceDueLabel } from "@/lib/invoices/service-dates";
import { invoiceAgreementDetails } from "@/lib/invoices/presentation";
import type { InvoiceBrand } from "@/lib/invoices/brand";
import {
  invoiceFigures,
  invoiceStatusLabel,
  invoiceTaxLabel,
  invoiceTermsLabel,
  invoiceTotalLabel,
} from "@/lib/invoices/figures";
import styles from "./InvoiceDocument.module.css";

// Ported from SuperDebate. @media print lives in the paired CSS module.
export type InvoiceView = InvoiceDraft &
  Partial<
    Pick<CommercialInvoice, "status" | "invoice_number" | "issued_at" | "due_at" | "paid_at">
  >;
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })
    : "Upon issue";

export function InvoiceDocument({
  invoice,
  brand,
  preview = false,
}: {
  invoice: InvoiceView;
  brand: InvoiceBrand;
  preview?: boolean;
}) {
  const agreement = invoiceAgreementDetails(invoice);
  return (
    <article className={styles.sheet} data-brand="accelerate" data-invoice-document>
      <div className={styles.accent} />
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element -- workspace logos are external URLs */}
            <img className={styles.brandMark} src={brand.mark} alt="" width={44} height={25} />
            <div>
              <strong>{brand.name.toUpperCase()}</strong>
              <small>INVOICE</small>
            </div>
          </div>
          <div className={styles.status} data-status={invoice.status || "draft"}>
            {invoiceStatusLabel(invoice, preview)}
          </div>
        </header>
        <div className={styles.headline}>
          <div>
            <p className={styles.eyebrow}>{invoiceKinds[invoice.kind].toUpperCase()}</p>
            <h1>
              Invoice<span>.</span>
            </h1>
            <p className={styles.description}>{invoice.description || "Invoice description"}</p>
          </div>
          <div className={styles.number}>
            <span>INVOICE NO.</span>
            <strong>{invoice.invoice_number || "Assigned when issued"}</strong>
          </div>
        </div>
        <div className={styles.parties}>
          <section>
            <p className={styles.label}>ISSUED BY</p>
            <strong>{brand.legalName}</strong>
            {brand.address && <p>{brand.address}</p>}
          </section>
          <section>
            <p className={styles.label}>BILL TO</p>
            <strong>{invoice.company_name || "Client"}</strong>
            {invoice.billing_line1 && <p>{formatBillingAddress(invoice)}</p>}
            {invoice.contact_name && (
              <p>
                {invoice.contact_name}
                <br />
                {invoice.contact_email}
              </p>
            )}
          </section>
        </div>
        <div className={styles.meta}>
          <div>
            <span>ISSUED</span>
            <strong>
              {date(invoice.invoice_date ? invoice.invoice_date + "T00:00:00Z" : invoice.issued_at)}
            </strong>
          </div>
          <div>
            <span>DUE</span>
            <strong>{invoiceDueLabel(invoice)}</strong>
          </div>
          <div>
            <span>TERMS</span>
            <strong>{invoiceTermsLabel(invoice)} · USD</strong>
          </div>
          {invoice.purchase_order && (
            <div>
              <span>PO NUMBER</span>
              <strong>{invoice.purchase_order}</strong>
            </div>
          )}
        </div>
        {agreement && (
          <section className={styles.support}>
            <p className={styles.label}>AGREEMENT DETAILS</p>
            <p>{agreement}</p>
          </section>
        )}
        <InvoiceLineItems invoice={invoice} />
        {invoice.notes && (
          <section className={styles.notes}>
            <p className={styles.label}>NOTES</p>
            <p>{invoice.notes}</p>
          </section>
        )}
        <footer className={styles.footer}>
          <span>Thank you for working with {brand.name}.</span>
          <strong>{brand.domain}</strong>
        </footer>
      </div>
    </article>
  );
}

/** The recipient page and printable record share the exact items and totals. */
export function InvoiceLineItems({ invoice }: { invoice: InvoiceView }) {
  const { subtotal, due, discountLabel } = invoiceFigures(invoice);
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <strong>{line.description || "Line item"}</strong>
                  {index === 0 && invoice.service_period && <small>{invoice.service_period}</small>}
                </td>
                <td>{line.quantity}</td>
                <td>{money(line.unit_cents)}</td>
                <td>{money(line.quantity * line.unit_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.totals}>
        <div>
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {Boolean(invoice.discount_cents) && (
          <div>
            <span>{discountLabel}</span>
            <span>−{money(invoice.discount_cents)}</span>
          </div>
        )}
        <div>
          <span>Tax</span>
          <span>{invoiceTaxLabel(invoice.tax_review)}</span>
        </div>
        <div className={styles.total}>
          <strong>{invoiceTotalLabel(invoice.status)}</strong>
          <strong>{money(due)}</strong>
        </div>
        {(invoice.status === "paid" || invoice.status === "paid_external") && (
          <div>
            <span>Balance due</span>
            <strong>$0.00</strong>
          </div>
        )}
      </div>
    </>
  );
}
