"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import {
  LEARNING_PROPOSAL_TYPES,
  type LearningProposal,
  type LearningProposalType,
  type LearningStatus,
} from "@/lib/revenue-os/learning-inbox-types";

const statusFilters: Array<{ id: LearningStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "proposed", label: "Proposed" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "conversation_only", label: "This conversation" },
  { id: "ignored", label: "Ignored" },
];

const statusTone: Record<LearningStatus, string> = {
  proposed: "bg-black/[0.055] text-[var(--admin-warning)] dark:bg-white/[0.07]",
  approved: "bg-black/[0.055] text-[var(--admin-success)] dark:bg-white/[0.07]",
  rejected: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]",
  conversation_only: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]",
  ignored: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]",
};

export default function LearningInboxPage() {
  const [proposals, setProposals] = useState<LearningProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LearningStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<LearningProposalType>("positioning_policy");
  const [formRule, setFormRule] = useState("");
  const [formRationale, setFormRationale] = useState("");
  const [formConfidence, setFormConfidence] = useState<"high" | "medium" | "low">("medium");
  const [formWorkers, setFormWorkers] = useState("");
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchProposals = useCallback(async () => {
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/learning${query}`);
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch {
      setToast({ message: "Failed to load learnings", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchProposals();
  }, [fetchProposals]);

  const handlePropose = async () => {
    if (!formRule.trim()) {
      setToast({ message: "Describe the learning first", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const affectedWorkers = formWorkers
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          rule: formRule,
          rationale: formRationale,
          confidence: formConfidence,
          affectedWorkers,
        }),
      });
      if (!res.ok) throw new Error("Propose failed");
      setToast({ message: "Learning proposed to the inbox", type: "success" });
      setFormRule("");
      setFormRationale("");
      setFormWorkers("");
      setFormConfidence("medium");
      setShowForm(false);
      await fetchProposals();
    } catch {
      setToast({ message: "Failed to propose learning", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleRowAction = async (id: string, body: Record<string, unknown>, done: string) => {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/learning/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setToast({ message: done, type: "success" });
      await fetchProposals();
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Action failed",
        type: "error",
      });
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Learning Inbox" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Learning Inbox"
        subtitle="Reusable corrections become approved shared intelligence. Nothing here reaches shared knowledge without approval."
      />

      <div className="space-y-6">
        <div>
          <AdminSurface padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                  <Brain className="size-4" />
                </span>
                <div>
                  <p className="admin-eyebrow">Institutional learning</p>
                  <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                    Proposed learnings
                  </h2>
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Propose learning
              </Button>
            </div>

            {showForm && (
              <div className="mb-5 space-y-3 rounded-xl bg-[var(--admin-surface-subtle)] p-4 shadow-[var(--admin-shadow-border)]">
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Type
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as LearningProposalType)}
                    className="admin-field mt-1 block w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm"
                  >
                    {LEARNING_PROPOSAL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Rule
                  <Input
                    value={formRule}
                    onChange={(e) => setFormRule(e.target.value)}
                    placeholder="Never describe us as an AI agency…"
                    className="mt-1"
                  />
                </label>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Rationale
                  <Input
                    value={formRationale}
                    onChange={(e) => setFormRationale(e.target.value)}
                    placeholder="Why is this reusable?"
                    className="mt-1"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                    Confidence
                    <select
                      value={formConfidence}
                      onChange={(e) =>
                        setFormConfidence(e.target.value as "high" | "medium" | "low")
                      }
                      className="admin-field mt-1 block w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                    Affected workers
                    <Input
                      value={formWorkers}
                      onChange={(e) => setFormWorkers(e.target.value)}
                      placeholder="proposal-writer, outreach-agent"
                      className="mt-1"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handlePropose} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save proposal"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {statusFilters.map((f) => (
                <Button
                  key={f.id}
                  variant={filter === f.id ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {proposals.length === 0 ? (
              <p className="admin-copy rounded-xl bg-[var(--admin-surface-subtle)] px-4 py-6 text-center text-sm">
                No learnings here yet. Corrections you mark as reusable will appear for review.
              </p>
            ) : (
              <div className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-border)]">
                {proposals.map((p) => (
                  <div key={p.id} className="px-4 py-4">
                    <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--admin-ink)]">{p.rule}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusTone[p.status]}`}
                          >
                            {p.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="admin-copy mt-1 text-pretty text-xs">
                          {p.proposal_type.replaceAll("_", " ")} · confidence {p.confidence} ·
                          authority {p.authority}
                        </p>
                        {p.rationale && (
                          <p className="admin-copy mt-1 text-pretty text-xs">{p.rationale}</p>
                        )}
                        {p.affected_workers.length > 0 && (
                          <p className="mt-1 font-mono text-[10px] text-[var(--admin-muted)]">
                            Affects: {p.affected_workers.join(", ")}
                          </p>
                        )}
                        {p.conflicts != null && (
                          <p className="mt-1 font-mono text-[10px] text-[var(--admin-warning)]">
                            Conflicts:{" "}
                            {typeof p.conflicts === "string"
                              ? p.conflicts
                              : JSON.stringify(p.conflicts)}
                          </p>
                        )}
                        {p.learned_policy_id && (
                          <p className="mt-1 break-all font-mono text-[10px] text-[var(--admin-muted)]">
                            Policy: {p.learned_policy_id}
                          </p>
                        )}
                        {p.status === "proposed" && p.approval_action_id && (
                          <p className="mt-1 font-mono text-[10px] text-[var(--admin-warning)]">
                            Awaiting approval in Today
                          </p>
                        )}
                      </div>

                      {p.status === "proposed" && (
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              handleRowAction(
                                p.id,
                                { action: "request-approval" },
                                "Sent to approvals",
                              )
                            }
                            disabled={acting === p.id}
                            title="Send to the approvals queue; nothing becomes shared until approved there"
                          >
                            {acting === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Send to approvals"
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              handleRowAction(
                                p.id,
                                { disposition: "conversation_only" },
                                "Kept to this conversation",
                              )
                            }
                            disabled={acting === p.id}
                          >
                            This conversation
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRowAction(p.id, { action: "reject" }, "Learning rejected")
                            }
                            disabled={acting === p.id}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {p.status !== "proposed" && p.status !== "approved" && (
                        <div className="flex shrink-0 justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              handleRowAction(
                                p.id,
                                { disposition: "proposed" },
                                "Learning revived for review",
                              )
                            }
                            disabled={acting === p.id}
                          >
                            Revive
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminSurface>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
