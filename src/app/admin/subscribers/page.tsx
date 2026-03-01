"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AtSign, Users, UserX } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
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

  if (loading) {
    return (
      <div>
        <PageHeader title="Newsletter Subscribers" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader title="Newsletter Subscribers" subtitle={`${total} total`} />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={AtSign} index={0} />
        <StatCard label="Active" value={stats.active} icon={Users} index={1} trend="up" change={`${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% active`} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} icon={UserX} index={2} />
      </div>

      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Source</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((sub, index) => (
              <motion.tr
                key={sub.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border-glass hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3 text-white-primary">{sub.email}</td>
                <td className="px-4 py-3 text-white-secondary capitalize">{sub.source || "website"}</td>
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
        {subscribers.length === 0 && (
          <EmptyState message="No subscribers yet" icon={AtSign} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </motion.div>
  );
}
