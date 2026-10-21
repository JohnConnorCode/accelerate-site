"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import { AtSign, Users, UserX, Search, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { EmptyState } from "@/components/admin/EmptyState";

interface Subscriber {
  id: string;
  email: string;
  source: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

interface Stats {
  total: number;
  active: number;
  unsubscribed: number;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, unsubscribed: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/subscribers?page=${page}`);
      if (!res.ok) throw new Error("Subscribers could not be loaded");
      const data = await res.json();
      setSubscribers(data.subscribers || []);
      setStats(data.stats || { total: 0, active: 0, unsubscribed: 0 });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscribers could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return subscribers.filter((sub) => {
      if (searchQuery && !sub.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter === "active" && sub.unsubscribed_at) return false;
      if (statusFilter === "unsubscribed" && !sub.unsubscribed_at) return false;
      return true;
    });
  }, [subscribers, searchQuery, statusFilter]);

  const handleExport = () => {
    window.open("/api/admin/subscribers/export", "_blank");
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title={adminPageName("subscribers")}
        subtitle={`Review subscription preferences before including people in outreach. ${total} total`}
      />
      <AdminReadBody
        loading={loading}
        hasData={!loading || subscribers.length > 0}
        error={error}
        onRetry={() => {
          setLoading(true);
          void fetchData();
        }}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading subscribers"
      >
        <div className="admin-grid admin-grid--metrics mb-6">
          <StatCard label="Total" value={stats.total} icon={AtSign} index={0} />
          <StatCard
            label="Active"
            value={stats.active}
            icon={Users}
            index={1}
            note={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% of subscribers`}
          />
          <StatCard label="Unsubscribed" value={stats.unsubscribed} icon={UserX} index={2} />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <Input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="admin-field admin-field--inline rounded-lg bg-[var(--admin-surface-subtle)] border border-[var(--admin-border)] px-3 py-1.5 text-sm text-[var(--admin-ink)] focus-visible:outline-none focus-visible:border-[var(--admin-action)] focus-visible:ring-1 focus-visible:ring-[var(--admin-action)]/30 transition-[border-color,box-shadow,background-color]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <GlassCard padding="none" hover="none" className="overflow-clip">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr>
                <th>Email</th>
                <th>Source</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub, index) => (
                <motion.tr
                  key={sub.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-hover-tint)] transition-colors"
                >
                  <td>
                    <Link
                      href={`/admin/contacts/${encodeURIComponent(sub.email)}`}
                      className="text-[var(--admin-ink)] hover:text-[var(--admin-ink)] transition-colors"
                    >
                      {sub.email}
                    </Link>
                  </td>
                  <td className="text-[var(--admin-muted)] capitalize">
                    {sub.source || "website"}
                  </td>
                  <td>
                    <StatusBadge status={sub.unsubscribed_at ? "unsubscribed" : "active"} />
                  </td>
                  <td className="text-[var(--admin-muted)] text-xs">
                    {new Date(sub.subscribed_at).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState message="No subscribers found" icon={AtSign} />}
        </GlassCard>

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </AdminReadBody>
    </motion.div>
  );
}
