"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { ProposalEditor } from "@/components/admin/ProposalEditor";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import { isInteractiveTarget } from "@/lib/admin/interaction";

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
  const searchParams = useSearchParams();
  const navigation = useAdminNavigation();

  const fetchProposals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const data = await fetchJson<{
        proposals?: Proposal[];
        totalOneTime?: number;
        totalMonthly?: number;
      }>(`/api/admin/proposals?${params}`);
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
    const requestedId = searchParams.get("proposal");
    const requested = proposals.find((proposal) => proposal.id === requestedId);
    setSelectedProposal(requested ?? null);
  }, [proposals, searchParams]);

  const openProposal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    navigation.push(`/admin/proposals?proposal=${encodeURIComponent(proposal.id)}`, "preserve");
  };

  const closeProposal = () => {
    setSelectedProposal(null);
    navigation.replace("/admin/proposals", "preserve");
  };

  const handleSave = async (updates: Record<string, unknown>) => {
    try {
      await fetchJson("/api/admin/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await fetchProposals();
      if (selectedProposal && updates.id === selectedProposal.id) {
        const data = await fetchJson<{ proposal: Proposal }>(
          `/api/admin/proposals?id=${selectedProposal.id}`,
        );
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
        openProposal(data.proposal);
        await fetchProposals();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create proposal");
    }
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        title={adminPageName("proposals")}
        subtitle={`$${totalMonthly.toLocaleString()}/mo · $${totalOneTime.toLocaleString()} one-time`}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateBlank}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-gold-gradient px-3 text-sm font-medium transition-[filter,transform] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
            >
              + New Proposal
            </button>
          </div>
        }
      />
      <AdminReadBody
        loading={loading}
        hasData={!loading || proposals.length > 0}
        onRetry={() => void fetchProposals()}
        loadingFallback={<LoadingSkeleton variant="table" />}
        label="Loading proposals"
      >
        {/* Filter */}
        <div className="flex gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="admin-field admin-field--inline"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
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
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
            <div className={selectedProposal ? "min-w-0 hidden lg:block" : "min-w-0"}>
              <GlassCard hover="none">
                <div className="overflow-x-auto">
                  <table className="admin-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-glass">
                        <th className="px-3 py-2 text-left text-xs uppercase text-white-muted">
                          Title
                        </th>
                        <th className="px-3 py-2 text-left text-xs uppercase text-white-muted">
                          Client
                        </th>
                        <th className="hidden px-3 py-2 text-left text-xs uppercase text-white-muted 2xl:table-cell">
                          Monthly
                        </th>
                        <th className="hidden px-3 py-2 text-left text-xs uppercase text-white-muted 2xl:table-cell">
                          One-Time
                        </th>
                        <th className="px-3 py-2 text-left text-xs uppercase text-white-muted">
                          Status
                        </th>
                        <th className="hidden px-3 py-2 text-left text-xs uppercase text-white-muted 2xl:table-cell">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposals.map((proposal, i) => (
                        <motion.tr
                          key={proposal.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          tabIndex={0}
                          aria-label={`Open ${proposal.title}`}
                          aria-selected={selectedProposal?.id === proposal.id}
                          className="cursor-pointer border-b border-border-glass transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] last:border-b-0"
                          onClick={(event) => {
                            if (isInteractiveTarget(event.target)) return;
                            openProposal(proposal);
                          }}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openProposal(proposal);
                            }
                          }}
                        >
                          <td className="px-3 py-2.5 font-medium text-white-primary">
                            {proposal.title}
                          </td>
                          <td className="px-3 py-2.5 text-white-secondary">
                            {proposal.client_name}
                          </td>
                          <td className="hidden px-3 py-2.5 text-emerald-400 2xl:table-cell">
                            ${proposal.total_monthly?.toLocaleString() || "0"}/mo
                          </td>
                          <td className="hidden px-3 py-2.5 text-white-secondary 2xl:table-cell">
                            ${proposal.total_one_time?.toLocaleString() || "0"}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={statusMap[proposal.status] || proposal.status} />
                          </td>
                          <td className="hidden px-3 py-2.5 text-xs text-white-muted 2xl:table-cell">
                            {new Date(proposal.created_at).toLocaleDateString()}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
            <section
              className={selectedProposal ? "min-w-0 block" : "min-w-0 hidden lg:block"}
              aria-label="Proposal details"
            >
              {selectedProposal ? (
                <div className="min-w-0 space-y-4">
                  <button
                    type="button"
                    onClick={closeProposal}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-white-muted transition-colors hover:bg-white/5 hover:text-white-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] lg:hidden"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Proposals
                  </button>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white-muted">
                      Selected proposal
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white-primary">
                      {selectedProposal.title}
                    </h2>
                    <p className="text-sm text-white-muted">{selectedProposal.client_name}</p>
                  </div>
                  <ProposalEditor proposal={selectedProposal} onSave={handleSave} />
                </div>
              ) : (
                <GlassCard
                  hover="none"
                  className="hidden min-h-56 place-items-center text-center lg:grid"
                >
                  <div>
                    <p className="text-sm font-semibold text-white-primary">Select a proposal</p>
                    <p className="mt-1 text-xs text-white-muted">
                      Choose a row to edit its content, pricing, status, or share link.
                    </p>
                  </div>
                </GlassCard>
              )}
            </section>
          </div>
        )}
      </AdminReadBody>
    </motion.div>
  );
}
