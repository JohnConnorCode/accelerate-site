"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, Play, Pause, CheckCircle, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
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
  next_send_at?: string;
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
  const [stats, setStats] = useState<Stats>({ active: 0, completed: 0, paused: 0, unsubscribed: 0, total: 0 });
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

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/email-sequences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: `Sequence ${status}`, type: "success" });
      await fetchData();
    } catch {
      setToast({ message: "Failed to update sequence", type: "error" });
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Email Sequences" />
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
      <PageHeader title="Email Sequences" />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard label="Active" value={stats.active} icon={Play} index={0} trend="up" change="sending" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle} index={1} />
        <StatCard label="Paused" value={stats.paused} icon={Pause} index={2} />
        <StatCard label="Total" value={stats.total} icon={Mail} index={3} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
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
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "paused", label: "Paused" },
            { value: "unsubscribed", label: "Unsubscribed" },
          ]}
          className="w-44"
        />
      </div>

      {/* Table */}
      <GlassCard padding="none" hover="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Step</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Next Send</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sequences.map((seq, index) => (
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
                <td className="px-4 py-3 text-white-secondary">{seq.current_step}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={seq.status} />
                </td>
                <td className="px-4 py-3 text-white-muted text-xs">
                  {seq.next_send_at
                    ? new Date(seq.next_send_at).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {seq.status === "active" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStatusChange(seq.id, "paused")}
                      className="text-yellow-300 text-xs px-2 py-1"
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {seq.status === "paused" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStatusChange(seq.id, "active")}
                      className="text-emerald-300 text-xs px-2 py-1"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {sequences.length === 0 && (
          <EmptyState message="No email sequences yet" icon={AlertCircle} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {toast && (
        <Toast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} />
      )}
    </motion.div>
  );
}
