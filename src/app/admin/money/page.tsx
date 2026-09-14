"use client";

import { FileText, HandCoins, RefreshCw, WalletCards } from "lucide-react";
import AdminLink from "@/components/admin/AdminLink";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";

type Overview = {
  metrics: { pipelineValue: number; weightedValue: number; wonRevenue: number };
  health?: { status: string };
};

const areas = [
  {
    href: "/admin/invoicing",
    label: "Invoices",
    detail: "Prepare, review, send, and track customer invoices.",
    icon: FileText,
  },
  {
    href: "/admin/collections",
    label: "Collections",
    detail: "Review verified balances, promises, disputes, and reminders.",
    icon: HandCoins,
  },
  {
    href: "/admin/revenue",
    label: "Revenue reporting",
    detail: "See recurring value, one-time revenue, and client performance.",
    icon: WalletCards,
  },
  {
    href: "/admin/recovery",
    label: "Follow-up recovery",
    detail: "Reconnect past demand from the Sales → Follow-ups workspace.",
    icon: RefreshCw,
  },
];

export default function MoneyPage() {
  const query = useAdminQuery<Overview>(
    ["admin", "money", "overview"],
    "/api/admin/revenue-os/overview",
  );
  const metrics = query.data?.metrics;
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Money"
        subtitle="One place to understand invoices, payments, collections, recurring billing, and cash that needs attention."
      />
      <AdminReadBody
        loading={query.isPending}
        hasData={Boolean(query.data)}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        refreshing={query.isFetching}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading money overview"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              "Open pipeline",
              metrics ? `$${metrics.pipelineValue.toLocaleString()}` : "—",
              "Current opportunity value",
            ],
            [
              "Weighted pipeline",
              metrics ? `$${metrics.weightedValue.toLocaleString()}` : "—",
              "Stage-weighted estimate",
            ],
            [
              "Won revenue",
              metrics ? `$${metrics.wonRevenue.toLocaleString()}` : "—",
              "Recorded closed value",
            ],
          ].map(([label, value, note]) => (
            <AdminSurface key={label} padding="lg">
              <p className="admin-eyebrow">{label}</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)]">
                {value}
              </p>
              <p className="admin-copy mt-1 text-xs">{note}</p>
            </AdminSurface>
          ))}
        </div>
        <AdminSurface padding="none" className="overflow-hidden">
          <div className="border-b border-[var(--admin-border)] px-5 py-4">
            <p className="admin-eyebrow">Money workspaces</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
              Choose the job you need to finish
            </h2>
            <p className="admin-copy mt-1 max-w-2xl text-sm">
              Each area owns its source records. Money is the shared entry point, while approvals
              and receipts keep external payment effects reviewable.
            </p>
          </div>
          <div className="grid gap-px bg-[var(--admin-border)] sm:grid-cols-2">
            {areas.map(({ href, label, detail, icon: Icon }) => (
              <AdminLink
                key={href}
                href={href}
                className="group bg-[var(--admin-surface)] p-5 transition-colors hover:bg-[var(--admin-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-ink)]"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--admin-surface-subtle)] text-[var(--admin-ink)]">
                  <Icon className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-[var(--admin-ink)]">{label}</h3>
                <p className="admin-copy mt-1 text-xs leading-5">{detail}</p>
                <span className="mt-4 inline-flex text-xs font-semibold text-[var(--admin-ink)] underline underline-offset-4">
                  Open {label.toLowerCase()} →
                </span>
              </AdminLink>
            ))}
          </div>
        </AdminSurface>
      </AdminReadBody>
    </div>
  );
}
