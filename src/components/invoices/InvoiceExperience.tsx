import { InvoiceLineItems, type InvoiceView } from "./InvoiceDocument";
import { InvoiceActions } from "./InvoiceActions";
import { discountLabel } from "@/lib/invoices/figures";
import { invoiceDueLabel, serviceDateLabel } from "@/lib/invoices/service-dates";
import { invoiceAgreementDetails } from "@/lib/invoices/presentation";
import { invoicePaymentMethodLabels, money } from "@/lib/invoices/schema";
import type { InvoiceBrand } from "@/lib/invoices/brand";
import styles from "./InvoiceExperience.module.css";

/** The customer's invoice page, ported from SuperDebate's client invoice. */
export function InvoiceExperience({
  invoice,
  brand,
  apiUrl,
  amount,
  preview = false,
}: {
  invoice: InvoiceView;
  brand: InvoiceBrand;
  apiUrl: string | null;
  amount: number;
  preview?: boolean;
}) {
  const agreement = invoiceAgreementDetails(invoice);
  const isDraft = !invoice.status || invoice.status === "draft";
  const isPaid = invoice.status === "paid" || invoice.status === "paid_external";
  const invoiceDate =
    invoice.invoice_date ||
    (invoice.issued_at ? new Date(invoice.issued_at).toISOString().slice(0, 10) : null);
  const amountLabel = isDraft
    ? "Invoice amount"
    : isPaid
      ? "Total paid"
      : invoice.status === "open"
        ? "Amount due"
        : "Invoice amount";
  return (
    <div className={styles.experience} data-brand="accelerate" data-invoice-experience>
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element -- workspace logos are external URLs */}
        <img src={brand.mark} alt="" width={38} height={38} />
        <span>
          {brand.name}
          <small>Private client invoice</small>
        </span>
        {brand.website && brand.domain && (
          <a className={styles.brandWebsite} href={brand.website}>
            {brand.domain.toLowerCase()}
          </a>
        )}
      </div>
      <section className={styles.hero} aria-label="Invoice overview">
        <div className={styles.heroContent}>
          <div className={styles.heroStory}>
            <p className={styles.partnerLabel}>Prepared for</p>
            <h1>{invoice.company_name || "Your organization"}</h1>
            <p className={styles.intro}>{invoice.description || "Invoice details"}</p>
            {invoice.service_period && <p className={styles.eventDate}>{invoice.service_period}</p>}
            {agreement && (
              <div className={styles.agreement}>
                <h2>Agreement details</h2>
                <p>{agreement}</p>
              </div>
            )}
          </div>
          <div className={styles.amountCard}>
            <span>{amountLabel}</span>
            <strong>{money(amount)}</strong>
            {Boolean(invoice.discount_cents) && (
              <small>
                Full price {money(amount + invoice.discount_cents)}
                <br />
                {discountLabel(invoice)} −{money(invoice.discount_cents)}
              </small>
            )}
            <dl className={styles.paymentMeta}>
              {invoiceDate && (
                <div>
                  <dt>Invoice date</dt>
                  <dd>{serviceDateLabel(invoiceDate)}</dd>
                </div>
              )}
              <div>
                <dt>Invoice</dt>
                <dd>{invoice.invoice_number || "Assigned when issued"}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{invoiceDueLabel(invoice)}</dd>
              </div>
              <div>
                <dt>Pay by</dt>
                <dd>
                  {invoice.payment_methods.map((m) => invoicePaymentMethodLabels[m]).join(" or ")}
                </dd>
              </div>
            </dl>
            <small>USD</small>
          </div>
        </div>
      </section>
      <div className={styles.actions}>
        <InvoiceActions
          apiUrl={apiUrl}
          status={invoice.status || "draft"}
          amount={amount}
          preview={preview}
          brandName={brand.name}
          supportEmail={brand.supportEmail}
        />
      </div>
      <section className={styles.summary} aria-labelledby="invoice-items-heading">
        <h2 id="invoice-items-heading">Items and pricing</h2>
        <InvoiceLineItems invoice={invoice} />
        {invoice.notes && (
          <div className={styles.notes}>
            <h3>Invoice notes</h3>
            <p>{invoice.notes}</p>
          </div>
        )}
      </section>
    </div>
  );
}
