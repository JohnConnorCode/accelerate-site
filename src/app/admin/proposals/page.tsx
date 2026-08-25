"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ProposalEditor } from "@/components/admin/ProposalEditor";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";

interface Proposal {
  id: string;
  lead_id: string | null;
  client_name: string;
  share_token: string;
  title: string;
  content: { sections: { title: string; content?: string }[] };
  total_one_time: number;
  total_monthly: number;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

const statusMap: Record<string, string> = {
  draft: "idea",
  sent: "qualified",
  viewed: "contacted",
  accepted: "won",
  declined: "lost",
};

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [totalOneTime, setTotalOneTime] = useState(0);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [generating] = useState(false);
  const deepLinkHandled = useRef(false);

  const fetchProposals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const data = await fetchJson<{ proposals?: Proposal[]; totalOneTime?: number; totalMonthly?: number }>(
        `/api/admin/proposals?${params}`,
      );
      setProposals(data.proposals || []);
      setTotalOneTime(data.totalOneTime || 0);
      setTotalMonthly(data.totalMonthly || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get("proposal");
    if (!requestedId || deepLinkHandled.current) return;
    const requested = proposals.find((proposal) => proposal.id === requestedId);
    if (requested) {
      deepLinkHandled.current = true;
      setSelectedProposal(requested);
    }
  }, [proposals]);

  const handleSave = async (updates: Record<string, unknown>) => {
    try {
      await fetchJson("/api/admin/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await fetchProposals();
      if (selectedProposal && updates.id === selectedProposal.id) {
        const data = await fetchJson<{ proposal: Proposal }>(`/api/admin/proposals?id=${selectedProposal.id}`);
        setSelectedProposal(data.proposal);
      }
      toast.success("Proposal saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save proposal");
    }
  };

  const handleCreateBlank = async () => {
    try {
      const data = await fetchJson<{ proposal?: Proposal }>("/api/admin/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "New Client",
          title: "New Proposal",
          content: {
            sections: [
              { title: "Executive Summary", content: "" },
              { title: "Proposed Solution", content: "" },
              { title: "Investment", content: "", pricing: [] },
              { title: "Next Steps", content: "" },
            ],
          },
        }),
      });
      if (data.proposal) {
        setSelectedProposal(data.proposal);
        await fetchProposals();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create proposal");
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Proposals" />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  if (selectedProposal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-4">
          <button
            onClick={() => setSelectedProposal(null)}
            className="inline-flex items-center gap-1.5 text-xs text-white-muted hover:text-white-secondary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Proposals
          </button>
        </div>
        <PageHeader
          title={selectedProposal.title}
          subtitle={selectedProposal.client_name}
        />
        <ProposalEditor proposal={selectedProposal} onSave={handleSave} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Proposals"
        subtitle={`$${totalMonthly.toLocaleString()}/mo · $${totalOneTime.toLocaleString()} one-time`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleCreateBlank}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gold-gradient hover:brightness-110 transition-[filter,transform] cursor-pointer"
            >
              + New Proposal
            </button>
          </div>
        }
      />

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-gold transition-[border-color,box-shadow,background-color]"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {generating && (
        <GlassCard hover="none" padding="md" className="mb-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-gold-light" />
            <p className="text-sm text-white-secondary">Generating proposal with AI...</p>
          </div>
        </GlassCard>
      )}

      {proposals.length === 0 ? (
        <EmptyState message="No proposals yet. Create one from a lead or start blank." />
      ) : (
        <GlassCard hover="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-glass">
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Title</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Client</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase hidden sm:table-cell">Monthly</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase hidden sm:table-cell">One-Time</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase">Status</th>
                  <th className="text-left px-3 py-2 text-xs text-white-muted uppercase hidden sm:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((proposal, i) => (
                  <motion.tr
                    key={proposal.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border-glass last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelectedProposal(proposal)}
                  >
                    <td className="px-3 py-2.5 text-white-primary font-medium">
                      {proposal.title}
                    </td>
                    <td className="px-3 py-2.5 text-white-secondary">
                      {proposal.client_name}
                    </td>
                    <td className="px-3 py-2.5 text-emerald-400 hidden sm:table-cell">
                      ${proposal.total_monthly?.toLocaleString() || "0"}/mo
                    </td>
                    <td className="px-3 py-2.5 text-white-secondary hidden sm:table-cell">
                      ${proposal.total_one_time?.toLocaleString() || "0"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={statusMap[proposal.status] || proposal.status} />
                    </td>
                    <td className="px-3 py-2.5 text-white-muted text-xs hidden sm:table-cell">
                      {new Date(proposal.created_at).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
}
