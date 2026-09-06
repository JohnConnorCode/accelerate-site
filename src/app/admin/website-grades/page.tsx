"use client";

import { useState, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import { ChevronDown, ChevronUp, Globe, Search, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { EmptyState } from "@/components/admin/EmptyState";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";

interface GradeCategory {
  score: number;
  label: string;
  issues: string[];
}

interface WebsiteGrade {
  id: string;
  url: string;
  email: string;
  overall_score: number;
  categories?: {
    performance?: GradeCategory;
    seo?: GradeCategory;
    mobile?: GradeCategory;
    security?: GradeCategory;
    accessibility?: GradeCategory;
  };
  ai_recommendations?: string[];
  created_at: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBadgeClass(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-300";
  if (score >= 60) return "bg-yellow-500/20 text-yellow-300";
  return "bg-red-500/20 text-red-300";
}

export default function WebsiteGradesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all");
  const gradesQuery = useAdminQuery<{
    grades?: WebsiteGrade[];
    total?: number;
    totalPages?: number;
  }>(["admin", "website-grades", page], `/api/admin/website-grades?page=${page}`);
  const grades = useMemo(() => gradesQuery.data?.grades ?? [], [gradesQuery.data?.grades]);
  const total = gradesQuery.data?.total ?? 0;
  const totalPages = gradesQuery.data?.totalPages ?? 1;
  const loading = gradesQuery.isPending;

  const filtered = useMemo(() => {
    return grades.filter((g) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!g.url.toLowerCase().includes(q) && !g.email.toLowerCase().includes(q)) return false;
      }
      if (scoreFilter === "high" && g.overall_score < 80) return false;
      if (scoreFilter === "medium" && (g.overall_score < 60 || g.overall_score >= 80)) return false;
      if (scoreFilter === "low" && g.overall_score >= 60) return false;
      return true;
    });
  }, [grades, searchQuery, scoreFilter]);

  const handleExport = () => {
    window.open("/api/admin/website-grades/export", "_blank");
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader title="Website Grades" subtitle={`${total} total`} />
      <AdminReadBody
        loading={loading}
        hasData={Boolean(gradesQuery.data)}
        error={gradesQuery.error?.message}
        onRetry={() => void gradesQuery.refetch()}
        refreshing={gradesQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="table" />}
        label="Loading website grades"
      >
        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
            <Input
              type="text"
              placeholder="Search by URL or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            aria-label="Filter by score"
            className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus-visible:outline-none focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-[var(--gold-base)]/30 transition-[border-color,box-shadow,background-color]"
          >
            <option value="all">All Scores</option>
            <option value="high">High (80+)</option>
            <option value="medium">Medium (60-79)</option>
            <option value="low">Low (&lt;60)</option>
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
                  URL
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                  Score
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                  Date
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((grade, index) => (
                <Fragment key={grade.id}>
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-border-glass hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === grade.id ? null : grade.id)}
                  >
                    <td className="px-4 py-3 text-white-primary font-medium truncate max-w-[200px]">
                      {grade.url}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/contacts/${encodeURIComponent(grade.email)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-white-secondary hover:text-gold-light transition-colors"
                      >
                        {grade.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getScoreBadgeClass(grade.overall_score)}>
                        {grade.overall_score}/100
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-white-muted text-xs">
                      {new Date(grade.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {expandedId === grade.id ? (
                        <ChevronUp className="h-4 w-4 text-white-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white-muted" />
                      )}
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {expandedId === grade.id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td colSpan={5} className="px-4 py-4 bg-bg-elevated">
                          <div className="space-y-4">
                            {grade.categories && (
                              <div>
                                <p className="text-xs text-white-muted mb-2 uppercase">
                                  Category Scores
                                </p>
                                <div className="grid gap-2 sm:grid-cols-5">
                                  {Object.entries(grade.categories).map(([key, cat]) => (
                                    <GlassCard key={key} padding="sm" hover="none">
                                      <p className="text-xs text-white-muted capitalize">{key}</p>
                                      <p
                                        className={cn(
                                          "text-lg font-bold",
                                          getScoreColor(cat.score),
                                        )}
                                      >
                                        {cat.score}
                                      </p>
                                      {cat.issues?.length > 0 && (
                                        <ul className="mt-1 space-y-0.5">
                                          {cat.issues.slice(0, 2).map((issue, i) => (
                                            <li key={i} className="text-[10px] text-white-muted">
                                              {issue}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </GlassCard>
                                  ))}
                                </div>
                              </div>
                            )}

                            {grade.ai_recommendations && grade.ai_recommendations.length > 0 && (
                              <div>
                                <p className="text-xs text-white-muted mb-2 uppercase">
                                  AI Recommendations
                                </p>
                                <ul className="space-y-1">
                                  {grade.ai_recommendations.map((rec, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2 text-sm text-white-secondary"
                                    >
                                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--gold-light)] shrink-0" />
                                      {rec}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState message="No website grades found" icon={Globe} />}
        </GlassCard>

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </AdminReadBody>
    </motion.div>
  );
}
