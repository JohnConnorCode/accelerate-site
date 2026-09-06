import type { WorkspaceBrand } from "./branding-contract";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
export function renderCollectionReminder(
  brand: WorkspaceBrand,
  currency: string,
  invoices: { invoiceId: string; remaining: number; dueDate: string | null; url: string }[],
  testMode = false,
) {
  const money = (minor: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(minor / 100);
  const subject = `${testMode ? "[Test] " : ""}Payment reminder from ${brand.name}`;
  const intro = `${testMode ? "This reminder concerns test invoices, not a real payment request. " : ""}Our records show ${money(invoices.reduce((n, i) => n + i.remaining, 0))} outstanding across ${invoices.length} overdue invoice${invoices.length === 1 ? "" : "s"}. Please review the invoices below. If you have a question or need to discuss payment, reply to this email.`;
  const text = `${brand.name}\n\n${intro}\n\n${invoices.map((i) => `${i.invoiceId} · Due ${i.dueDate} · ${money(i.remaining)}\n${i.url}`).join("\n\n")}\n\nThank you,\n${brand.legalName || brand.name}\n${brand.businessAddress}`;
  const html = `<html><body style="margin:0;padding:32px 16px;background:${brand.backgroundColor};color:${brand.inkColor};font-family:${brand.font === "serif" ? "Georgia,serif" : "Arial,sans-serif"}"><main style="max-width:600px;margin:auto;padding:32px;background:#fff;border-top:4px solid ${brand.accentColor}">${brand.logoUrl ? `<img src="${escape(brand.logoUrl)}" alt="${escape(brand.name)}" width="120" style="max-height:64px;object-fit:contain"/>` : `<strong>${escape(brand.name)}</strong>`}<h1 style="font-size:26px">Payment reminder</h1><p style="line-height:1.6">${escape(intro)}</p><table style="width:100%;border-collapse:collapse"><caption style="text-align:left;padding:12px 0;font-weight:bold">Outstanding invoices (${escape(currency.toUpperCase())})</caption><thead><tr><th scope="col" align="left">Invoice / due date</th><th scope="col" align="right">Remaining</th></tr></thead><tbody>${invoices.map((i) => `<tr><td style="padding:16px 0;border-top:1px solid #ddd"><a href="${escape(i.url)}" style="color:${brand.inkColor}">${escape(i.invoiceId)}</a><br/><small>Due ${i.dueDate}</small></td><td align="right" style="border-top:1px solid #ddd">${escape(money(i.remaining))}</td></tr>`).join("")}</tbody></table><p style="font-size:22px"><strong>Total ${escape(money(invoices.reduce((n, i) => n + i.remaining, 0)))}</strong></p><p style="line-height:1.6">Thank you,<br/>${escape(brand.legalName || brand.name)}<br/>${escape(brand.businessAddress)}</p></main></body></html>`;
  return { subject, text, html };
}
