"use client";

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

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/subscribers?page=${page}`);
      const data = await res.json();
      setSubscribers(data.subscribers || []);
      setStats(data.stats || { total: 0, active: 0, unsubscribed: 0 });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      // silent
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

  if (loading) {
    return (
      <div>
        <PageHeader title="Newsletter Subscribers" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader title="Newsletter Subscribers" subtitle={`${total} total`} />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={AtSign} index={0} />
        <StatCard
          label="Active"
          value={stats.active}
          icon={Users}
          index={1}
          trend="up"
          change={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% active`}
        />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} icon={UserX} index={2} />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
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
          className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-gold transition-[border-color,box-shadow,background-color]"
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Email
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Source
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sub, index) => (
              <motion.tr
                key={sub.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border-glass hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/contacts/${encodeURIComponent(sub.email)}`}
                    className="text-white-primary hover:text-gold-light transition-colors"
                  >
                    {sub.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-white-secondary capitalize">
                  {sub.source || "website"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={sub.unsubscribed_at ? "unsubscribed" : "active"} />
                </td>
                <td className="px-4 py-3 text-white-muted text-xs">
                  {new Date(sub.subscribed_at).toLocaleDateString()}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState message="No subscribers found" icon={AtSign} />}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </motion.div>
  );
}
