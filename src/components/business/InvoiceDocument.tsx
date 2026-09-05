import { BusinessLogo } from "./BusinessLogo";
import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
import { brandButtonInk } from "@/lib/revenue-os/branding-contract";
export type InvoiceDocumentData = {
  number: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  lines: { description: string; amount: number }[];
  total: number;
  amountPaid: number;
  amountRemaining: number;
  status: string;
  dueLabel: string;
  paymentUrl?: string | null;
};
export type InvoiceDesign = {
  layout: "classic" | "editorial";
  heading: string;
  introduction: string;
  closing: string;
};
import { defaultInvoiceDesign } from "@/lib/revenue-os/invoice-page-contract";
export { defaultInvoiceDesign } from "@/lib/revenue-os/invoice-page-contract";
/** A single renderer serves the brand preview and the billing document. Provider
 * amounts are supplied separately from editable/AI-generated presentation. */
export function InvoiceDocument({
  brand,
  invoice,
  design = defaultInvoiceDesign,
  preview = false,
}: {
  brand: WorkspaceBrand;
  invoice: InvoiceDocumentData;
  design?: InvoiceDesign;
  preview?: boolean;
}) {
  const money = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(
      amount / 100,
    );
  return (
    <section
      aria-label={preview ? "Invoice design preview" : "Customer invoice"}
      className="overflow-hidden rounded-2xl shadow-[0_12px_48px_#17203312]"
      style={{
        backgroundColor: "#ffffff",
        color: brand.inkColor,
        fontFamily: brand.font === "serif" ? "Georgia, serif" : "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{ backgroundColor: brand.accentColor }}
        className={design.layout === "editorial" ? "h-3" : "h-1.5"}
      />
      <div className="p-6 sm:p-9">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <BusinessLogo brand={brand} />
            <p className="text-lg font-semibold">{brand.name}</p>
            {brand.tagline && <p className="mt-1 max-w-xs text-xs leading-5">{brand.tagline}</p>}
          </div>
          <div className="text-sm">
            <p className="font-semibold">{invoice.number}</p>
            <p className="mt-2 capitalize">{invoice.status}</p>
            {preview && (
              <p className="mt-2 text-xs font-semibold">Sample · Not a payable invoice</p>
            )}
          </div>
        </header>
        <div className="mt-10">
          <h2
            className={`${design.layout === "editorial" ? "text-4xl" : "text-3xl"} font-semibold tracking-tight text-balance`}
          >
            {design.heading}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6">{design.introduction}</p>
        </div>
        <div className="my-8 grid gap-5 border-y border-current/10 py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest">Bill to</p>
            <p className="mt-2 font-semibold">{invoice.customerName}</p>
            <p className="mt-1 break-all">{invoice.customerEmail}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest">Payment due</p>
            <p className="mt-2 font-semibold">{invoice.dueLabel}</p>
          </div>
        </div>
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Invoice line items</caption>
          <thead>
            <tr className="border-b border-current/10 text-[10px] uppercase tracking-widest">
              <th className="pb-3 font-semibold">Description</th>
              <th className="w-28 pb-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index} className="border-b border-current/10">
                <td className="py-4 pr-4 break-words leading-6">{line.description}</td>
                <td className="py-4 text-right align-top tabular-nums">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-6 max-w-xs space-y-3 text-sm tabular-nums">
          <div className="flex justify-between gap-3">
            <dt>Invoice total</dt>
            <dd>{money(invoice.total)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Payments received</dt>
            <dd>{money(invoice.amountPaid)}</dd>
          </div>
          {invoice.total - invoice.amountPaid - invoice.amountRemaining !== 0 && (
            <div className="flex justify-between gap-3">
              <dt>Credits & adjustments</dt>
              <dd>{money(invoice.amountRemaining + invoice.amountPaid - invoice.total)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-current/10 pt-4 text-lg font-semibold">
            <dt>Amount due</dt>
            <dd>{money(invoice.amountRemaining)}</dd>
          </div>
        </dl>
        {invoice.paymentUrl &&
          !preview &&
          invoice.status === "open" &&
          invoice.amountRemaining > 0 && (
            <a
              href={invoice.paymentUrl}
              rel="noreferrer"
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold active:scale-[.98]"
              style={{
                backgroundColor: brand.accentColor,
                color: brandButtonInk(brand.accentColor),
              }}
            >
              Pay securely with Stripe
            </a>
          )}
        <footer className="mt-10 border-t border-current/10 pt-6 text-xs leading-6">
          <p>{design.closing}</p>
          {brand.supportEmail && (
            <a href={`mailto:${brand.supportEmail}`} className="underline">
              {brand.supportEmail}
            </a>
          )}
          <p className="mt-4 font-semibold">{brand.legalName || brand.name}</p>
          {brand.businessAddress && <p className="whitespace-pre-line">{brand.businessAddress}</p>}
        </footer>
      </div>
    </section>
  );
}
