"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useEffect, useState, useCallback, useRef } from "react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { Search, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { fetchJson } from "@/lib/admin/fetchJson";

interface Client {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  industry: string | null;
  status: string;
  monthly_value: number;
  one_time_value: number;
  contract_start: string | null;
  contract_end: string | null;
  created_at: string;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "churned", label: "Churned" },
];

export default function ClientsPage() {
  const navigation = useAdminNavigation();
  const requestVersion = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchClients = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const data = await fetchJson<{ clients?: Client[]; totalMRR?: number; activeCount?: number }>(
        `/api/admin/clients?${params}`,
      );
      if (version !== requestVersion.current) return;
      setError(null);
      setClients(data.clients || []);
      setTotalMRR(data.totalMRR || 0);
      setActiveCount(data.activeCount || 0);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  if (loading) {
    return (
      <div>
        <PageHeader title={adminPageName("clients")} />
        <LoadingSkeleton variant="table" count={6} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={adminPageName("clients")}
        subtitle={`${activeCount} active · $${totalMRR.toLocaleString()}/mo MRR`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="min-h-11 rounded-xl bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
            placeholder="Search clients..."
            className="min-h-11 w-full rounded-xl bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none placeholder:text-[var(--admin-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
          />
        </div>
      </div>

      {/* MRR Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <AdminSurface padding="sm">
          <p className="admin-eyebrow">Monthly recurring</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--admin-ink)]">
            ${totalMRR.toLocaleString()}
          </p>
        </AdminSurface>
        <AdminSurface padding="sm">
          <p className="admin-eyebrow">Active clients</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
            {activeCount}
          </p>
        </AdminSurface>
        <AdminSurface padding="sm">
          <p className="admin-eyebrow">Average MRR / client</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--admin-ink)]">
            ${activeCount > 0 ? Math.round(totalMRR / activeCount).toLocaleString() : "0"}
          </p>
        </AdminSurface>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm">
          {error}{" "}
          <button type="button" className="min-h-11 underline" onClick={() => void fetchClients()}>
            Retry
          </button>
        </p>
      )}
      {/* Client Table */}
      {clients.length === 0 ? (
        <EmptyState
          message={
            search || statusFilter !== "all"
              ? "No clients match these filters. Try another name or status."
              : "No clients yet. Win a lead to create your first client!"
          }
        />
      ) : (
        <AdminSurface padding="none" className="overflow-hidden">
          <p className="px-4 py-3 text-xs text-[var(--admin-muted)]">
            Open a client to review their history, update their plan, or add a follow-up.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]">
                  {["Business", "Contact", "Industry", "MRR", "Status", "Since", ""].map(
                    (label, index) => (
                      <th
                        key={label}
                        scope="col"
                        className={`px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)] ${index === 1 ? "hidden md:table-cell" : index === 2 || index === 5 ? "hidden sm:table-cell" : ""}`}
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    data-client-row={client.id}
                    onClick={(event) => {
                      if (
                        !(event.target instanceof Element) ||
                        event.target.closest("a,button,input,select,textarea")
                      )
                        return;
                      if (window.getSelection()?.toString()) return;
                      navigation.push(`/admin/clients/${client.id}`);
                    }}
                    className="cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-subtle)]"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="inline-flex min-h-11 items-center font-semibold text-[var(--admin-ink)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2"
                      >
                        {client.business_name}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <div>
                        <Link
                          href={`/admin/contacts/${encodeURIComponent(client.contact_email)}`}
                          className="inline-flex min-h-10 items-center text-xs text-[var(--admin-ink)] hover:underline"
                        >
                          {client.contact_name}
                        </Link>
                        <p className="text-[10px] text-[var(--admin-muted)]">
                          {client.contact_email}
                        </p>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs capitalize text-[var(--admin-muted)] sm:table-cell">
                      {client.industry?.replace(/_/g, " ") || "N/A"}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-[var(--admin-ink)]">
                      ${client.monthly_value?.toLocaleString() || "0"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-[var(--admin-muted)] sm:table-cell">
                      {client.contract_start
                        ? new Date(client.contract_start).toLocaleDateString()
                        : new Date(client.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        aria-label={`Open ${client.business_name}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)] focus-visible:outline focus-visible:outline-2"
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSurface>
      )}
    </div>
  );
}
