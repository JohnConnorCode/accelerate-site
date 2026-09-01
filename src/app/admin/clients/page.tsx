"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "@/components/admin/AdminLink";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";

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
  const [clients, setClients] = useState<Client[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchClients = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const data = await fetchJson<{ clients?: Client[]; totalMRR?: number; activeCount?: number }>(
        `/api/admin/clients?${params}`,
      );
      setClients(data.clients || []);
      setTotalMRR(data.totalMRR || 0);
      setActiveCount(data.activeCount || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Clients" />
        <LoadingSkeleton variant="table" count={6} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${activeCount} active · $${totalMRR.toLocaleString()}/mo MRR`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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

      {/* Client Table */}
      {clients.length === 0 ? (
        <EmptyState message="No clients yet. Win a lead to create your first client!" />
      ) : (
        <AdminSurface padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]">
                  {["Business", "Contact", "Industry", "MRR", "Status", "Since"].map(
                    (label, index) => (
                      <th
                        key={label}
                        className={`px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)] ${index === 2 || index === 5 ? "hidden sm:table-cell" : ""}`}
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
                    className="border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-subtle)]"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="font-semibold text-[var(--admin-ink)] transition-opacity hover:opacity-70"
                      >
                        {client.business_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="text-xs text-[var(--admin-ink)]">{client.contact_name}</p>
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
