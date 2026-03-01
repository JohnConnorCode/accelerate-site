"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";

interface ResourceDownload {
  id: string;
  resource_id: string;
  name: string;
  email: string;
  company?: string;
  downloaded_at: string;
}

export default function ResourcesPage() {
  const [downloads, setDownloads] = useState<ResourceDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalDownloads: 0, uniqueUsers: 0 });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/resources?page=${page}`);
      const data = await res.json();
      setDownloads(data.downloads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setStats(data.stats || { totalDownloads: 0, uniqueUsers: 0 });
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
        <PageHeader title="Resource Downloads" />
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
      <PageHeader title="Resource Downloads" subtitle={`${total} total downloads`} />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard label="Total Downloads" value={stats.totalDownloads} icon={Download} index={0} />
        <StatCard label="Unique Users" value={stats.uniqueUsers} icon={Users} index={1} />
      </div>

      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Resource</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {downloads.map((dl, index) => (
              <motion.tr
                key={dl.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border-glass hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3 text-white-primary font-medium">{dl.name}</td>
                <td className="px-4 py-3 text-white-secondary">{dl.email}</td>
                <td className="px-4 py-3 text-white-secondary capitalize">
                  {dl.resource_id.replace(/[-_]/g, " ")}
                </td>
                <td className="px-4 py-3 text-white-muted text-xs">
                  {new Date(dl.downloaded_at).toLocaleDateString()}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {downloads.length === 0 && (
          <EmptyState message="No resource downloads yet" icon={Download} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </motion.div>
  );
}
