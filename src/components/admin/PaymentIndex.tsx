"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowUpRight, Download, RefreshCw, Wallet } from "lucide-react";
import { AdminSurface } from "./AdminSurface";
import { AdminReadBody } from "./AdminReadBody";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { BillingActionControl } from "./BillingActionControl";
import { fetchJson } from "@/lib/admin/fetchJson";
import {
  paymentPageSchema,
  paymentOverview,
  paymentsCsv,
} from "@/lib/revenue-os/billing-command-contract";
import { formatInvoiceAmount } from "@/lib/revenue-os/stripe-contract";
import styles from "./InvoiceIndex.module.css";

export function PaymentIndex({
  enabled,
  connectionKey,
}: {
  enabled: boolean;
  connectionKey: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const query = useInfiniteQuery({
    queryKey: ["admin", "invoicing", "payments", connectionKey],
    enabled,
    initialPageParam: null as { cursor: string; connection: string } | null,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams(
        pageParam ? { starting_after: pageParam.cursor, connection: pageParam.connection } : {},
      );
      const page = paymentPageSchema.parse(
        await fetchJson(`/api/admin/invoicing/payments?${params}`, { signal }),
      );
      if (
        pageParam &&
        (page.connection !== pageParam.connection || page.nextCursor === pageParam.cursor)
      )
        throw new Error("The payment list changed. Refresh before loading more.");
      return page;
    },
    getNextPageParam: (page) =>
      page.hasMore && page.nextCursor
        ? { cursor: page.nextCursor, connection: page.connection }
        : undefined,
  });
  const seen = new Set<string>();
  const payments = enabled
    ? (query.data?.pages ?? [])
        .flatMap((page) => page.payments)
        .filter((payment) => {
          if (seen.has(payment.id)) return false;
          seen.add(payment.id);
          return true;
        })
    : [];
  const term = search.trim().toLowerCase();
  const cutoff = period === "all" ? 0 : query.dataUpdatedAt - Number(period) * 86400000;
  const visible = payments.filter((payment) => {
    const matches =
      status === "all" ||
      (status === "refunded" ? payment.refunded > 0 : payment.status === status);
    return (
      matches &&
      Date.parse(payment.createdAt) >= cutoff &&
      (!term ||
        [payment.id, payment.name, payment.email, payment.description].some((text) =>
          text?.toLowerCase().includes(term),
        ))
    );
  });
  const overview = paymentOverview(visible);
  function download() {
    const url = URL.createObjectURL(
      new Blob([paymentsCsv(visible)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments-${query.data?.pages[0]?.testMode ? "test" : "live"}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AdminSurface padding="lg" className={styles.workspace}>
      <div className={styles.heading}>
        <div>
          <h2 className="text-lg font-semibold">Payment activity</h2>
          <p className="admin-copy mt-1 max-w-2xl text-sm">
            Inspect charges, review a refund, and export the payment records you select.
          </p>
        </div>
        {enabled && (
          <button
            type="button"
            className="admin-button admin-button--secondary"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {query.isFetching && !query.isFetchingNextPage ? "Refreshing…" : "Refresh payments"}
          </button>
        )}
      </div>
      {!enabled ? (
        <EmptyState
          title="Connect your billing account"
          description="Connect Stripe below to review payments and refunds."
          icon={Wallet}
        />
      ) : (
        <AdminReadBody
          loading={query.isPending}
          hasData={Boolean(query.data)}
          error={query.isFetchNextPageError ? undefined : query.error?.message}
          onRetry={() => void query.refetch()}
          refreshing={query.isFetching && !query.isFetchingNextPage}
          loadingFallback={<LoadingSkeleton variant="table" />}
          label="Loading payments"
        >
          {query.data && (
            <>
              <div className={styles.scope}>
                <span className={styles.mode}>
                  {query.data.pages[0]?.testMode ? "Test mode" : "Live mode"}
                </span>
                <p className="admin-copy text-xs">
                  {payments.length} account payments loaded
                  {query.hasNextPage
                    ? "; older payments are available below"
                    : "; all account payments are loaded"}
                  . Figures cover your current selection.
                </p>
              </div>
              <dl className={styles.metrics}>
                {(
                  [
                    { id: "captured", label: "Captured", help: "Successful captured charges" },
                    { id: "refunded", label: "Refunded", help: "Stripe's recorded refund amounts" },
                    {
                      id: "retained",
                      label: "After refunds",
                      help: "Before fees, disputes and payouts",
                    },
                  ] as const
                ).map(({ id, label, help }) => (
                  <div key={id} className={styles.metric} data-payment-metric={id}>
                    <dt className={styles.metricLabel}>{label}</dt>
                    <dd className={styles.metricValues}>
                      {overview.length ? (
                        overview.map(([currency, values]) => (
                          <span key={currency}>
                            {formatInvoiceAmount(values[id], currency)}{" "}
                            <small>{currency.toUpperCase()}</small>
                          </span>
                        ))
                      ) : (
                        <span>No captured payments</span>
                      )}
                    </dd>
                    <dd className="admin-copy mt-2 text-xs">{help}</dd>
                  </div>
                ))}
              </dl>
              <div className={styles.filters} role="search" aria-label="Find payments">
                <label>
                  <span className="sr-only">Search loaded payments</span>
                  <input
                    className="admin-field min-h-11 w-full"
                    type="search"
                    placeholder="Payment, customer or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className={styles.select}>
                  <span>Payment status</span>
                  <select
                    className="admin-field"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="all">All payments</option>
                    <option value="succeeded">Succeeded</option>
                    <option value="refunded">Has refunds</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                <label className={styles.select}>
                  <span>Period</span>
                  <select
                    className="admin-field"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                  >
                    <option value="all">All loaded dates</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                </label>
              </div>
              <div className={styles.results}>
                <p role="status" className="admin-copy text-xs">
                  {visible.length} of {payments.length} loaded payments selected
                </p>
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  disabled={!visible.length}
                  onClick={download}
                >
                  <Download className="size-4" aria-hidden="true" />
                  Export selected payments
                </button>
              </div>
              {visible.length ? (
                <ul className={styles.list} aria-label="Payment results">
                  {visible.map((payment) => (
                    <li key={payment.id} className={styles.invoice}>
                      <div className="min-w-0 flex-1">
                        <div className={styles.invoiceTitle}>
                          <h3 className="break-words font-semibold">
                            {payment.name ?? payment.email ?? payment.id}
                          </h3>
                          <span
                            className={styles.badge}
                            data-tone={
                              payment.disputed || payment.status === "failed"
                                ? "danger"
                                : payment.status === "succeeded"
                                  ? "success"
                                  : "neutral"
                            }
                          >
                            {payment.disputed
                              ? "Disputed"
                              : payment.refunded >= payment.captured && payment.refunded > 0
                                ? "Refunded"
                                : payment.refunded > 0
                                  ? "Partially refunded"
                                  : payment.status}
                          </span>
                        </div>
                        <p className="admin-copy mt-1 break-all text-xs">
                          {payment.id}
                          {payment.email ? ` · ${payment.email}` : ""}
                        </p>
                        <p className="admin-copy mt-2 text-xs">
                          {new Date(payment.createdAt).toLocaleDateString()}
                          {payment.workspaceOwned
                            ? " · Workspace payment"
                            : payment.ownershipNeedsCheck
                              ? " · Invoice ownership checked during review"
                              : " · Outside this workspace"}
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="font-semibold">
                          {formatInvoiceAmount(payment.captured, payment.currency)}{" "}
                          {payment.currency.toUpperCase()}
                        </p>
                        {payment.refunded > 0 && (
                          <p className="admin-copy text-xs">
                            {formatInvoiceAmount(payment.refunded, payment.currency)} refunded
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {payment.receiptUrl && (
                          <a
                            className="admin-button admin-button--secondary"
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open receipt ${payment.id}`}
                          >
                            Receipt
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                          </a>
                        )}
                        {payment.refundable && (
                          <BillingActionControl
                            label={
                              payment.workspaceOwned ? "Refund payment" : "Check refund eligibility"
                            }
                            currency={payment.currency}
                            intent={{
                              operation: "refund_payment",
                              chargeId: payment.id,
                              amount: payment.captured - payment.refunded,
                              reason: "requested_by_customer",
                            }}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No matching loaded payments"
                  description="Try another customer, status or date range. Load older payments below to include more history."
                  icon={Wallet}
                />
              )}
              {query.isFetchNextPageError && (
                <p role="alert" className={styles.moreError}>
                  {query.error?.message} Current payments remain visible.
                </p>
              )}
              <div className={styles.footer}>
                <p className="admin-copy max-w-2xl text-xs">
                  Refunds require an exact human review and apply to payments belonging to this
                  workspace. Bank balances and fees are not included in this report.
                </p>
                {query.hasNextPage && (
                  <button
                    type="button"
                    className="admin-button admin-button--secondary"
                    disabled={query.isFetching}
                    onClick={() => void query.fetchNextPage()}
                  >
                    {query.isFetchingNextPage
                      ? "Loading…"
                      : query.isFetchNextPageError
                        ? "Retry older payments"
                        : "Load more payments"}
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
