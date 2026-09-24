"use client";

import { useState } from "react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { formatInvoiceAmount } from "@/lib/revenue-os/stripe-contract";

type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number | null;
  remaining: number | null;
  currency: string | null;
  contactName: string | null;
  contactEmail: string | null;
  dueDate: string | null;
  hostedInvoiceUrl: string | null;
  createdAt: string;
};

export function InvoiceIndex({ enabled }: { enabled: boolean }) {
  type InvoicePage = { invoices: Invoice[]; hasMore: boolean; nextCursor: string | null };
  const [pages, setPages] = useState<InvoicePage[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const listing = useAdminQuery<InvoicePage>(
    ["admin", "invoice-index"],
    "/api/admin/invoicing/list",
    { enabled },
  );
  const invoices = [...(listing.data?.invoices ?? []), ...pages.flatMap((page) => page.invoices)];
  const lastPage = pages[pages.length - 1] ?? listing.data;
  const loadMore = async () => {
    if (!lastPage?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    try {
      const page = await fetchJson<InvoicePage>(
        `/api/admin/invoicing/list?starting_after=${encodeURIComponent(lastPage.nextCursor)}`,
      );
      setPages((current) => [...current, page]);
    } catch (error) {
      setMoreError(error instanceof Error ? error.message : "More invoices could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <AdminSurface padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">All invoices</h2>
          <p className="admin-copy mt-1 text-sm">
            Invoices from your connected Stripe account, including those created outside this app.
            Payment status comes from Stripe.
          </p>
        </div>
        <span className="admin-copy text-sm">{invoices.length} loaded</span>
      </div>
      {!enabled && (
        <p className="admin-copy mt-4 text-sm">Connect Stripe to load account invoices.</p>
      )}
      {moreError && (
        <p role="alert" className="mt-4 text-sm text-[var(--admin-danger)]">
          {moreError}
        </p>
      )}
      {listing.error && (
        <p role="alert" className="mt-4 text-sm text-[var(--admin-danger)]">
          {listing.error.message}
        </p>
      )}
      {enabled && listing.isPending && <p className="admin-copy mt-4 text-sm">Loading invoices…</p>}
      {!listing.isPending && enabled && !invoices.length && !listing.error && (
        <p className="admin-copy mt-4 text-sm">No invoices in this Stripe account yet.</p>
      )}
      <div className="mt-4 divide-y divide-[var(--admin-border)]">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{invoice.number ?? invoice.id}</p>
              {(invoice.contactName || invoice.contactEmail) && (
                <p className="admin-copy text-sm">
                  {invoice.contactName ?? invoice.contactEmail}
                  {invoice.contactName && invoice.contactEmail ? ` · ${invoice.contactEmail}` : ""}
                </p>
              )}
              <p className="admin-copy text-sm">
                {invoice.status ?? "Status unknown"}
                {invoice.remaining != null
                  ? ` · ${formatInvoiceAmount(invoice.remaining, invoice.currency)} outstanding`
                  : ""}
              </p>
              <p className="admin-copy text-xs">
                Created {new Date(invoice.createdAt).toLocaleDateString()}
                {invoice.dueDate ? ` · Due ${invoice.dueDate}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {invoice.hostedInvoiceUrl && (
                <a
                  className="admin-button admin-button--secondary"
                  href={invoice.hostedInvoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open invoice
                </a>
              )}
              <a className="admin-button admin-button--secondary" href="#invoice-operations">
                Invoice tools
              </a>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="admin-copy text-sm">Showing {invoices.length} invoices</span>
        <button
          type="button"
          className="admin-button admin-button--secondary"
          disabled={!lastPage?.hasMore || loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more invoices"}
        </button>
      </div>
    </AdminSurface>
  );
}
