"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import { Download, Users, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState("all");

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

  const resourceTypes = useMemo(() => {
    const types = new Set(downloads.map((d) => d.resource_id));
    return Array.from(types);
  }, [downloads]);

  const filtered = useMemo(() => {
    return downloads.filter((dl) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!dl.name.toLowerCase().includes(q) && !dl.email.toLowerCase().includes(q)) return false;
      }
      if (resourceFilter !== "all" && dl.resource_id !== resourceFilter) return false;
      return true;
    });
  }, [downloads, searchQuery, resourceFilter]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Resource Downloads" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader title="Resource Downloads" subtitle={`${total} total downloads`} />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard label="Total Downloads" value={stats.totalDownloads} icon={Download} index={0} />
        <StatCard label="Unique Users" value={stats.uniqueUsers} icon={Users} index={1} />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {resourceTypes.length > 1 && (
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-gold transition-[border-color,box-shadow,background-color]"
          >
            <option value="all">All Resources</option>
            {resourceTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/[-_]/g, " ")}
              </option>
            ))}
          </select>
        )}
      </div>

      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Email
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Resource
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dl, index) => (
              <motion.tr
                key={dl.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border-glass hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3 text-white-primary font-medium">{dl.name}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/contacts/${encodeURIComponent(dl.email)}`}
                    className="text-white-secondary hover:text-gold-light transition-colors"
                  >
                    {dl.email}
                  </Link>
                </td>
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
        {filtered.length === 0 && (
          <EmptyState message="No resource downloads found" icon={Download} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </motion.div>
  );
}
