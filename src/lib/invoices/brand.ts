import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";

/** Presentation for invoice pages, documents and PDFs, from workspace branding. */
export type InvoiceBrand = {
  name: string;
  legalName: string;
  address: string;
  website: string;
  domain: string;
  mark: string;
  supportEmail: string;
};
export function invoiceBrand(
  brand: Pick<
    WorkspaceBrand,
    "name" | "legalName" | "businessAddress" | "siteUrl" | "logoUrl" | "supportEmail"
  >,
): InvoiceBrand {
  let domain = "";
  try {
    domain = brand.siteUrl ? new URL(brand.siteUrl).hostname.replace(/^www\./, "") : "";
  } catch {
    domain = "";
  }
  return {
    name: brand.name,
    legalName: brand.legalName || brand.name,
    address: [brand.businessAddress, brand.supportEmail].filter(Boolean).join("\n"),
    website: brand.siteUrl,
    domain: domain.toUpperCase(),
    mark: brand.logoUrl || "/branding/invoice-mark.svg",
    supportEmail: brand.supportEmail,
  };
}
