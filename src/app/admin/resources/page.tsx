"use client";

import { adminPageName } from "@/lib/admin/navigation";
import { useMemo, useState } from "react";
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
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { CanonicalSourceLink } from "@/components/admin/CanonicalSourceLink";
import { SourceToolDispositions } from "@/components/admin/SourceToolDispositions";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import type { SourceFieldDisposition } from "@/lib/revenue-os/retained-source-dispositions";
import { AIReadinessPanel } from "@/components/admin/AIReadinessPanel";

interface ResourceDownload {
  id: string;
  resource_id: string;
  name: string;
  email: string;
  company?: string;
  downloaded_at: string;
  revenue_os?: {
    contact_id: string | null;
    opportunity_id: string | null;
    stage: string | null;
    linked_by: "source" | "identity" | "email" | null;
  };
}

export default function ResourcesPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState("all");
  const downloadsQuery = useAdminQuery<{
    downloads?: ResourceDownload[];
    total?: number;
    totalPages?: number;
    stats?: { totalDownloads: number; uniqueUsers: number };
    canonicalSchemaReady?: boolean;
    dispositions?: SourceFieldDisposition[];
  }>(["admin", "resources", page], `/api/admin/resources?page=${page}`);
  const downloads = useMemo(
    () => downloadsQuery.data?.downloads ?? [],
    [downloadsQuery.data?.downloads],
  );
  const total = downloadsQuery.data?.total ?? 0;
  const totalPages = downloadsQuery.data?.totalPages ?? 1;
  const stats = downloadsQuery.data?.stats ?? { totalDownloads: 0, uniqueUsers: 0 };
  const loading = downloadsQuery.isPending;

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

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title={adminPageName("resources")}
        subtitle={`Manage the customer-facing resources available to download. ${total} total downloads`}
      />
      <AdminReadBody
        loading={loading}
        hasData={Boolean(downloadsQuery.data)}
        error={downloadsQuery.error?.message}
        onRetry={() => void downloadsQuery.refetch()}
        refreshing={downloadsQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading resource downloads"
      >
        <AIReadinessPanel />

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <StatCard
            label="Total Downloads"
            value={stats.totalDownloads}
            icon={Download}
            index={0}
          />
          <StatCard label="Unique Users" value={stats.uniqueUsers} icon={Users} index={1} />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
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
              aria-label="Filter by resource type"
              className="admin-field admin-field--inline rounded-lg bg-[var(--admin-surface-subtle)] border border-[var(--admin-border)] px-3 py-1.5 text-sm text-[var(--admin-ink)] focus-visible:outline-none focus-visible:border-[var(--admin-action)] focus-visible:ring-1 focus-visible:ring-[var(--gold-base)]/30 transition-[border-color,box-shadow,background-color]"
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
          <table className="admin-table w-full text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Resource</th>
                <th>Date</th>
                <th>Canonical</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((dl, index) => (
                <motion.tr
                  key={dl.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-b border-[var(--admin-border)] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="text-[var(--admin-ink)] font-medium">{dl.name}</td>
                  <td>
                    <Link
                      href={`/admin/contacts/${encodeURIComponent(dl.email)}`}
                      className="text-[var(--admin-muted)] hover:text-[var(--admin-ink)] transition-colors"
                    >
                      {dl.email}
                    </Link>
                  </td>
                  <td className="text-[var(--admin-muted)] capitalize">
                    {dl.resource_id.replace(/[-_]/g, " ")}
                  </td>
                  <td className="text-[var(--admin-muted)] text-xs">
                    {new Date(dl.downloaded_at).toLocaleDateString()}
                  </td>
                  <td>
                    <CanonicalSourceLink
                      link={dl.revenue_os}
                      schemaReady={downloadsQuery.data?.canonicalSchemaReady}
                    />
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
        <SourceToolDispositions
          schemaReady={downloadsQuery.data?.canonicalSchemaReady}
          dispositions={downloadsQuery.data?.dispositions}
        />
      </AdminReadBody>
    </motion.div>
  );
}
