"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { GlassCard } from "@/components/ui/GlassCard";
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Clients"
        subtitle={`${activeCount} active · $${totalMRR.toLocaleString()}/mo MRR`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-gold transition-[border-color,box-shadow,background-color]"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full rounded-lg bg-bg-subtle border border-border-glass pl-9 pr-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-gold transition-[border-color,box-shadow,background-color] placeholder:text-white-muted"
          />
        </div>
      </div>

      {/* MRR Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <GlassCard hover="none" padding="sm">
          <p className="text-xs text-white-muted">Monthly Recurring</p>
          <p className="text-xl font-display font-bold text-gold-gradient">${totalMRR.toLocaleString()}</p>
        </GlassCard>
        <GlassCard hover="none" padding="sm">
          <p className="text-xs text-white-muted">Active Clients</p>
          <p className="text-xl font-display font-bold text-emerald-400">{activeCount}</p>
        </GlassCard>
        <GlassCard hover="none" padding="sm">
          <p className="text-xs text-white-muted">Avg MRR/Client</p>
          <p className="text-xl font-display font-bold text-white-primary">
            ${activeCount > 0 ? Math.round(totalMRR / activeCount).toLocaleString() : "0"}
          </p>
        </GlassCard>
      </div>

      {/* Client Table */}
      {clients.length === 0 ? (
        <EmptyState message="No clients yet. Win a lead to create your first client!" />
      ) : (
        <GlassCard hover="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-glass">
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Business</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Contact</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase hidden sm:table-cell">Industry</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">MRR</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Status</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase hidden sm:table-cell">Since</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border-glass last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-white-primary hover:text-gold-light transition-colors font-medium"
                      >
                        {client.business_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="text-white-secondary text-xs">{client.contact_name}</p>
                        <p className="text-white-muted text-[10px]">{client.contact_email}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-white-secondary text-xs capitalize hidden sm:table-cell">
                      {client.industry?.replace(/_/g, " ") || "N/A"}
                    </td>
                    <td className="px-3 py-2.5 text-emerald-400 font-medium">
                      ${client.monthly_value?.toLocaleString() || "0"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-3 py-2.5 text-white-muted text-xs hidden sm:table-cell">
                      {client.contract_start
                        ? new Date(client.contract_start).toLocaleDateString()
                        : new Date(client.created_at).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
}
