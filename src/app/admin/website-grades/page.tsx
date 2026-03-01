"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";

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
  const [grades, setGrades] = useState<WebsiteGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/website-grades?page=${page}`);
      const data = await res.json();
      setGrades(data.grades || []);
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
        <PageHeader title="Website Grades" />
        <LoadingSkeleton variant="table" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader title="Website Grades" subtitle={`${total} total`} />

      <GlassCard padding="none" hover="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">URL</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Date</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {grades.map((grade, index) => (
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
                  <td className="px-4 py-3 text-white-secondary">{grade.email}</td>
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
                          {/* Category breakdown */}
                          {grade.categories && (
                            <div>
                              <p className="text-xs text-white-muted mb-2 uppercase">Category Scores</p>
                              <div className="grid gap-2 sm:grid-cols-5">
                                {Object.entries(grade.categories).map(([key, cat]) => (
                                  <GlassCard key={key} padding="sm" hover="none">
                                    <p className="text-xs text-white-muted capitalize">{key}</p>
                                    <p className={cn("text-lg font-bold", getScoreColor(cat.score))}>
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

                          {/* AI Recommendations */}
                          {grade.ai_recommendations && grade.ai_recommendations.length > 0 && (
                            <div>
                              <p className="text-xs text-white-muted mb-2 uppercase">AI Recommendations</p>
                              <ul className="space-y-1">
                                {grade.ai_recommendations.map((rec, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-white-secondary">
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
        {grades.length === 0 && (
          <EmptyState message="No website grades yet" icon={Globe} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </motion.div>
  );
}
