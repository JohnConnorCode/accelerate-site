"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Clock3,
  FilePenLine,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { AdminSurface } from "./AdminSurface";
import { AdminReadBody } from "./AdminReadBody";
import { EmptyState } from "./EmptyState";
import { BillingActionControl } from "./BillingActionControl";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { fetchJson } from "@/lib/admin/fetchJson";
import { formatInvoiceAmount } from "@/lib/revenue-os/stripe-contract";
import {
  invoiceFilters,
  invoiceIndexPageSchema,
  invoiceIsOverdue,
  invoiceOverview,
  loadedInvoices,
  selectInvoices,
  type InvoiceFilter,
} from "@/lib/revenue-os/invoice-index-contract";
import styles from "./InvoiceIndex.module.css";

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const metrics = [
  { id: "open", label: "Awaiting payment", detail: "Open invoice balances", icon: Wallet },
  { id: "overdue", label: "Past due", detail: "Included in awaiting payment", icon: Clock3 },
  { id: "draft", label: "In draft", detail: "Prepared, not yet issued", icon: FilePenLine },
] as const;

export function InvoiceIndex({
  enabled,
  connectionKey = "current",
}: {
  enabled: boolean;
  connectionKey?: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceFilter>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "due">("newest");
  const listing = useInfiniteQuery({
    queryKey: ["admin", "invoicing", "list", connectionKey],
    initialPageParam: null as { cursor: string; connection: string } | null,
    enabled,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams(
        pageParam
          ? {
              starting_after: pageParam.cursor,
              connection: pageParam.connection,
            }
          : {},
      );
      const page = invoiceIndexPageSchema.parse(
        await fetchJson(`/api/admin/invoicing/list?${params}`, { signal }),
      );
      if (
        pageParam &&
        (page.connection !== pageParam.connection || page.nextCursor === pageParam.cursor)
      )
        throw new Error("The invoice list changed. Refresh invoices before loading more.");
      return page;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor
        ? { cursor: lastPage.nextCursor, connection: lastPage.connection }
        : undefined,
  });
  const invoices = enabled ? loadedInvoices(listing.data?.pages ?? []) : [];
  const now = listing.dataUpdatedAt;
  const overview = invoiceOverview(invoices, now);
  const visible = selectInvoices(invoices, { search, status, sort, now });
  const filtered = search.trim() !== "" || status !== "all";
  const resetFilters = () => {
    setSearch("");
    setStatus("all");
  };
  const refreshing = listing.isFetching && !listing.isFetchingNextPage;

  return (
    <AdminSurface padding="lg" className={styles.workspace}>
      <div className={styles.heading}>
        <div>
          <h2 className="text-lg font-semibold">All invoices</h2>
          <p className="admin-copy mt-1 max-w-2xl text-pretty text-sm">
            Your connected Stripe account, including invoices created outside Command Center.
          </p>
        </div>
        {enabled && (
          <button
            type="button"
            className="admin-button admin-button--secondary"
            disabled={listing.isFetching}
            onClick={() => void listing.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh invoices"}
          </button>
        )}
      </div>
      {!enabled ? (
        <EmptyState
          title="Connect your billing account"
          description="Connect Stripe below to review invoices and outstanding balances."
          icon={Wallet}
        />
      ) : (
        <AdminReadBody
          loading={listing.isPending}
          hasData={Boolean(listing.data)}
          error={listing.isFetchNextPageError ? undefined : listing.error?.message}
          onRetry={() => void listing.refetch()}
          refreshing={refreshing}
          loadingFallback={<LoadingSkeleton variant="table" />}
          label="Loading invoices"
        >
          {listing.data && (
            <>
              <div className={styles.scope}>
                <span className={styles.mode}>
                  {listing.data.pages[0]?.testMode ? "Test mode" : "Live mode"}
                </span>
                <p className="admin-copy text-xs">
                  Balances below cover {invoices.length} loaded{" "}
                  {invoices.length === 1 ? "invoice" : "invoices"}.
                  {listing.hasNextPage
                    ? " Older invoices are available below."
                    : " All account invoices are loaded."}{" "}
                  Currencies stay separate. Payment status comes from Stripe.
                </p>
              </div>
              <dl className={styles.metrics}>
                {metrics.map(({ id, label, detail, icon: Icon }) => (
                  <div key={id} className={styles.metric} data-invoice-metric={id}>
                    <dt className={styles.metricLabel}>
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </dt>
                    <dd className={styles.metricValues}>
                      {overview.balances.length ? (
                        overview.balances.map(([currency, balance]) => (
                          <span key={currency}>
                            {formatInvoiceAmount(balance[id], currency)}{" "}
                            <small>{currency.toUpperCase()}</small>
                          </span>
                        ))
                      ) : (
                        <span>{overview.counts[id] ? "Balance unavailable" : "No invoices"}</span>
                      )}
                    </dd>
                    <dd className="admin-copy mt-2 text-xs">
                      {overview.counts[id]} {overview.counts[id] === 1 ? "invoice" : "invoices"} ·{" "}
                      {detail}
                    </dd>
                  </div>
                ))}
              </dl>
              {overview.unknownBalances > 0 && (
                <p role="status" className="admin-copy text-sm">
                  Balances are incomplete for {overview.unknownBalances} invoices. Unknown amounts
                  are excluded from the figures above.
                </p>
              )}
              <div className={styles.filters} role="search" aria-label="Find invoices">
                <label className={styles.search}>
                  <span className="sr-only">Search loaded invoices</span>
                  <Search className="size-4" aria-hidden="true" />
                  <input
                    className="admin-field"
                    type="search"
                    placeholder="Invoice, customer or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className={styles.select}>
                  <span>Status</span>
                  <select
                    className="admin-field"
                    aria-label="Status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as InvoiceFilter)}
                  >
                    {invoiceFilters.map((filter) => (
                      <option key={filter.id} value={filter.id}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.select}>
                  <span>Sort</span>
                  <select
                    className="admin-field"
                    aria-label="Sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as typeof sort)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="due">Due date first</option>
                  </select>
                </label>
              </div>
              <div className={styles.results}>
                <p role="status" className="admin-copy text-xs">
                  {visible.length} of {invoices.length} loaded invoices{filtered ? " match" : ""}
                </p>
                {filtered && (
                  <button
                    type="button"
                    className="admin-button admin-button--secondary"
                    onClick={resetFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {visible.length === 0 ? (
                <EmptyState
                  title={
                    filtered ? "No matching loaded invoices" : "Your invoice workspace is ready"
                  }
                  description={
                    filtered
                      ? "Try another customer, number or status. Load older invoices below to search more history."
                      : "Create your first customer invoice using the button at the top of this page."
                  }
                  icon={Search}
                  {...(filtered
                    ? { actionLabel: "Reset search and status", onAction: resetFilters }
                    : {})}
                />
              ) : (
                <ul className={styles.list} aria-label="Invoice results">
                  {visible.map((invoice) => {
                    const overdue = invoiceIsOverdue(invoice, now);
                    const label = overdue
                      ? "Overdue"
                      : invoice.status === "open"
                        ? "Awaiting payment"
                        : (invoice.status ?? "Status unknown");
                    return (
                      <li key={invoice.id} className={styles.invoice}>
                        <div className={styles.identity}>
                          <span className={styles.documentIcon} aria-hidden="true">
                            <FilePenLine className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <div className={styles.invoiceTitle}>
                              <h3 className="break-words font-semibold">
                                {invoice.number ?? invoice.id}
                              </h3>
                              <span
                                className={styles.badge}
                                data-tone={
                                  overdue
                                    ? "danger"
                                    : invoice.status === "paid"
                                      ? "success"
                                      : "neutral"
                                }
                              >
                                {label}
                              </span>
                            </div>
                            <p className="admin-copy mt-1 break-words text-sm">
                              {invoice.contactName ??
                                invoice.contactEmail ??
                                "Customer not provided"}
                            </p>
                            {invoice.contactName && invoice.contactEmail && (
                              <p className="admin-copy break-all text-xs">{invoice.contactEmail}</p>
                            )}
                            <p className="admin-copy mt-2 text-xs">
                              Created {date(invoice.createdAt)}
                              {invoice.dueDate ? ` · Due ${date(invoice.dueDate)}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className={styles.invoiceAmount}>
                          <p className="text-base font-semibold tabular-nums">
                            {formatInvoiceAmount(
                              invoice.status === "open" ? invoice.remaining : invoice.amountDue,
                              invoice.currency,
                            )}
                          </p>
                          <p className="admin-copy text-xs">
                            {invoice.currency?.toUpperCase()} ·{" "}
                            {invoice.status === "open" ? "Remaining" : "Invoice amount"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {invoice.hostedInvoiceUrl && (
                            <a
                              className="admin-button admin-button--secondary"
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open invoice ${invoice.number ?? invoice.id}`}
                            >
                              Open invoice
                              <ArrowUpRight className="size-4" aria-hidden="true" />
                            </a>
                          )}
                          {invoice.managed &&
                            invoice.amountPaid === 0 &&
                            (invoice.status === "open" || invoice.status === "uncollectible") && (
                              <BillingActionControl
                                label="Void unpaid invoice"
                                intent={{ operation: "void_invoice", invoiceId: invoice.id }}
                              />
                            )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {listing.isFetchNextPageError && (
                <div role="alert" className={styles.moreError}>
                  <p>Older invoices could not be loaded. Your current results remain available.</p>
                  <p className="admin-copy mt-1 text-xs">{listing.error?.message}</p>
                </div>
              )}
              <div className={styles.footer}>
                <a className="admin-button admin-button--secondary" href="#invoice-operations">
                  Review invoice actions
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                </a>
                {listing.hasNextPage && (
                  <button
                    type="button"
                    className="admin-button admin-button--secondary"
                    disabled={listing.isFetching}
                    onClick={() => void listing.fetchNextPage()}
                  >
                    {listing.isFetchingNextPage
                      ? "Loading…"
                      : listing.isFetchNextPageError
                        ? "Retry older invoices"
                        : "Load more invoices"}
                  </button>
                )}
              </div>
            </>
          )}
        </AdminReadBody>
      )}
    </AdminSurface>
  );
}
