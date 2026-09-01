"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, Play, AlertCircle, CheckCircle2, PauseCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";
import { Toast } from "@/components/ui/Toast";

interface EmailSequence {
  id: string;
  email: string;
  sequence_type: string;
  current_step: number;
  status: string;
  metadata?: {
    resend_email_ids?: string[];
    [key: string]: unknown;
  };
  created_at: string;
}

interface Stats {
  active: number;
  completed: number;
  paused: number;
  unsubscribed: number;
  total: number;
}

export default function EmailSequencesPage() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [stats, setStats] = useState<Stats>({
    active: 0,
    completed: 0,
    paused: 0,
    unsubscribed: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/email-sequences?${params}`);
      const data = await res.json();
      setSequences(data.sequences || []);
      setStats(data.stats || { active: 0, completed: 0, paused: 0, unsubscribed: 0, total: 0 });
      setTotalPages(data.totalPages || 1);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Email Sequences" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title="Email Sequences"
        subtitle="Monitor every active nurture path and its delivery lifecycle."
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard label="Total" value={stats.total} icon={Mail} index={0} />
        <StatCard label="Active" value={stats.active} icon={Play} index={1} />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} index={2} />
        <StatCard label="Paused" value={stats.paused} icon={PauseCircle} index={3} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All Types" },
            { value: "plan_nurture", label: "Plan Nurture" },
            { value: "resource_welcome", label: "Resource Welcome" },
            { value: "grader_followup", label: "Grader Followup" },
          ]}
          className="w-44"
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "completed", label: "Completed" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "unsubscribed", label: "Unsubscribed" },
          ]}
          className="w-44"
        />
      </div>

      {/* Table */}
      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Email
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Emails
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">
                Enrolled
              </th>
            </tr>
          </thead>
          <tbody>
            {sequences.map((seq, index) => {
              const emailCount = seq.metadata?.resend_email_ids?.length ?? seq.current_step ?? 0;
              return (
                <motion.tr
                  key={seq.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-b border-border-glass hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-white-primary">{seq.email}</td>
                  <td className="px-4 py-3 text-white-secondary capitalize">
                    {seq.sequence_type?.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-white-secondary">{emailCount} emails</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={seq.status} />
                  </td>
                  <td className="px-4 py-3 text-white-muted text-xs">
                    {seq.created_at ? new Date(seq.created_at).toLocaleDateString() : "-"}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {sequences.length === 0 && (
          <EmptyState message="No email sequences yet" icon={AlertCircle} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </motion.div>
  );
}
