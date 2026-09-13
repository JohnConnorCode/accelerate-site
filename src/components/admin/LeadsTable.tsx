"use client";

import { useState, Fragment, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  ArrowUpDown,
  Trash2,
  Users,
  Tag,
  UserX,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/admin/fetchJson";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { calculateLeadScore, getScoreColor, getScoreLabel } from "@/lib/admin/lead-scoring";
import { PIPELINE_STAGES } from "@/lib/admin/pipeline-stages";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "./StatusBadge";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";
import { LeadDetail } from "./LeadDetail";

interface Lead {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  business_name?: string;
  industry: string;
  lead_status: string;
  created_at: string;
  intake_data?: Record<string, unknown>;
  ai_plan?: Record<string, unknown>;
  notes?: string;
  view_count?: number;
  estimated_value?: number;
  revenue_os?: { opportunity_id: string | null; contact_id: string | null; stage: string | null };
}

interface BulkRecordOutcome {
  contactId: string;
  status: "applied" | "skipped" | "failed";
  reason: string;
}

export interface BulkContactResult {
  outcomes: BulkRecordOutcome[];
  applied: number;
  skipped: number;
  failed: number;
}

interface LeadsTableProps {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
  onUpdateLead: (
    id: string,
    data: { lead_status?: string; notes?: string; estimated_value?: number },
  ) => void;
  onBulkStatus: (ids: string[], status: string) => Promise<boolean>;
  onBulkDelete: (ids: string[]) => Promise<boolean>;
  onBulkTag: (
    contactIds: string[],
    tags: { add: string[]; remove: string[] },
  ) => Promise<BulkContactResult | null>;
  onBulkSuppress: (contactIds: string[]) => Promise<BulkContactResult | null>;
  onBulkEnroll: (contactIds: string[], campaignId: string) => Promise<BulkContactResult | null>;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  sortField: string;
  sortOrder: string;
}

// Bulk status options: canonical pipeline stages plus "lost".
const statusOptions = [...PIPELINE_STAGES.map((s) => s.key), "lost"];

export function LeadsTable({
  leads,
  total,
  page,
  totalPages,
  onUpdateLead,
  onBulkStatus,
  onBulkDelete,
  onBulkTag,
  onBulkSuppress,
  onBulkEnroll,
  onPageChange,
  onSort,
  sortField,
  sortOrder,
}: LeadsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [scoreSort, setScoreSort] = useState<"asc" | "desc" | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagMode, setTagMode] = useState<"add" | "remove">("add");
  const [confirmSuppress, setConfirmSuppress] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollCampaigns, setEnrollCampaigns] = useState<
    Array<{ id: string; name: string; status: string }>
  >([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [enrollCampaignId, setEnrollCampaignId] = useState("");
  const [outcome, setOutcome] = useState<{ title: string; result: BulkContactResult } | null>(null);

  const filtered = useMemo(() => {
    let result = leads.filter((lead) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        lead.contact_name.toLowerCase().includes(q) ||
        lead.contact_email.toLowerCase().includes(q) ||
        (lead.business_name?.toLowerCase().includes(q) ?? false)
      );
    });

    // Client-side score sort
    if (scoreSort) {
      result = [...result].sort((a, b) => {
        const scoreA = calculateLeadScore(a);
        const scoreB = calculateLeadScore(b);
        return scoreSort === "asc" ? scoreA - scoreB : scoreB - scoreA;
      });
    }

    return result;
  }, [leads, searchQuery, scoreSort]);

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  };

  const handleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkStatus("");
    setConfirmDelete(false);
    setTagInput("");
    setConfirmSuppress(false);
  };

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    const ok = await onBulkStatus(Array.from(selectedIds), bulkStatus);
    setBulkBusy(false);
    if (ok) clearSelection();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    const ok = await onBulkDelete(Array.from(selectedIds));
    setBulkBusy(false);
    if (ok) clearSelection();
    else setConfirmDelete(false);
  };

  // Bulk contact operations resolve through the canonical contact linked to
  // each lead. Leads without a contact record cannot be tagged, suppressed,
  // or enrolled, so they are left out before any write happens.
  const selectedLeads = leads.filter((lead) => selectedIds.has(lead.id));
  const linkedContactIds = () => [
    ...new Set(
      selectedLeads
        .map((lead) => lead.revenue_os?.contact_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const unlinkedCount = () => selectedLeads.filter((lead) => !lead.revenue_os?.contact_id).length;

  const finishBulkContacts = (title: string, result: BulkContactResult | null) => {
    if (!result) return;
    setOutcome({ title, result });
    if (result.failed === 0) {
      clearSelection();
      setTagInput("");
      setConfirmSuppress(false);
      setEnrollOpen(false);
      setEnrollCampaignId("");
    }
  };

  const handleBulkTag = async () => {
    const raw = tagInput.trim();
    if (!raw || bulkBusy) return;
    const tags = raw
      .split(/[\s,;]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!tags.length) return;
    setBulkBusy(true);
    try {
      finishBulkContacts(
        tagMode === "add" ? "Tags added" : "Tags removed",
        await onBulkTag(linkedContactIds(), {
          add: tagMode === "add" ? tags : [],
          remove: tagMode === "remove" ? tags : [],
        }),
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkSuppress = async () => {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      finishBulkContacts("Contacts suppressed", await onBulkSuppress(linkedContactIds()));
    } finally {
      setBulkBusy(false);
    }
  };

  const openEnroll = async () => {
    setEnrollOpen(true);
    setEnrollLoading(true);
    setEnrollError("");
    try {
      const data = await fetchJson<{
        campaigns?: Array<{ id: string; name: string; status: string }>;
      }>("/api/admin/revenue-os/campaigns");
      setEnrollCampaigns((data.campaigns ?? []).filter((c) => c.status === "draft"));
    } catch (error) {
      setEnrollError(error instanceof Error ? error.message : "Could not load draft campaigns");
      setEnrollCampaigns([]);
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleBulkEnroll = async () => {
    if (!enrollCampaignId || bulkBusy) return;
    setBulkBusy(true);
    try {
      finishBulkContacts(
        "Contacts staged for campaign",
        await onBulkEnroll(linkedContactIds(), enrollCampaignId),
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExport = () => {
    window.open("/api/admin/leads/export", "_blank");
  };

  const handleScoreSort = () => {
    if (scoreSort === null) setScoreSort("desc");
    else if (scoreSort === "desc") setScoreSort("asc");
    else setScoreSort(null);
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
          <Input
            type="text"
            placeholder="Search by name, email, or business..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Bulk actions */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassCard padding="sm" hover="none" className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm text-white-secondary">{selectedIds.size} selected</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                aria-label="Set status for selected leads"
                disabled={bulkBusy}
                className="rounded-lg glass px-3 py-1.5 text-sm text-white-primary bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <option value="">Change status to...</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkUpdate}
                disabled={!bulkStatus || bulkBusy}
              >
                Apply
              </Button>

              <span className="hidden h-5 w-px bg-white/10 sm:block" aria-hidden="true" />
              <Tag className="h-3.5 w-3.5 text-white-muted" aria-hidden="true" />
              <select
                value={tagMode}
                onChange={(e) => setTagMode(e.target.value === "remove" ? "remove" : "add")}
                aria-label="Add or remove tags"
                disabled={bulkBusy}
                className="rounded-lg glass px-3 py-1.5 text-sm text-white-primary bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <option value="add">Add tags</option>
                <option value="remove">Remove tags</option>
              </select>
              <Input
                type="text"
                placeholder="vip, newsletter…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                aria-label="Tags to apply, separated by spaces or commas"
                disabled={bulkBusy}
                className="w-44"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkTag}
                disabled={!tagInput.trim() || bulkBusy || linkedContactIds().length === 0}
              >
                {tagMode === "add" ? "Tag" : "Untag"}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={openEnroll}
                disabled={bulkBusy || linkedContactIds().length === 0}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Enroll…
              </Button>

              {confirmSuppress ? (
                <span className="inline-flex items-center gap-2">
                  <span className="text-sm text-white-secondary">
                    Suppress {linkedContactIds().length} contact
                    {linkedContactIds().length === 1 ? "" : "s"} from campaign email?
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBulkSuppress}
                    disabled={bulkBusy}
                    className="!border-[var(--admin-danger)] !text-[var(--admin-danger)] hover:!bg-[var(--admin-danger-soft)]"
                  >
                    {bulkBusy ? "Suppressing..." : "Confirm"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmSuppress(false)}
                    disabled={bulkBusy}
                  >
                    Cancel
                  </Button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSuppress(true)}
                  disabled={bulkBusy || linkedContactIds().length === 0}
                  aria-label="Suppress selected contacts from campaign email"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-danger-soft)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)] cursor-pointer"
                >
                  <UserX className="h-3.5 w-3.5" />
                  Suppress
                </button>
              )}
              {unlinkedCount() > 0 && (
                <span className="text-xs text-white-muted">
                  {unlinkedCount()} selected lead{unlinkedCount() === 1 ? " has" : "s have"} no
                  contact record and will be skipped.
                </span>
              )}

              {confirmDelete ? (
                <span className="inline-flex items-center gap-2">
                  <span className="text-sm text-white-secondary">Delete {selectedIds.size}?</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkBusy}
                    className="!border-[var(--admin-danger)] !text-[var(--admin-danger)] hover:!bg-[var(--admin-danger-soft)]"
                  >
                    {bulkBusy ? "Deleting..." : "Confirm"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={bulkBusy}
                  >
                    Cancel
                  </Button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={bulkBusy}
                  aria-label="Delete selected leads"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-danger-soft)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}

              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkBusy}>
                Clear
              </Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="admin-table w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th scope="col" className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={handleSelectAll}
                  aria-label="Select all leads"
                  className="rounded cursor-pointer"
                />
              </th>
              <SortHeader
                field="contact_name"
                onSort={onSort}
                sortField={sortField}
                sortOrder={sortOrder}
              >
                Name
              </SortHeader>
              <SortHeader
                field="business_name"
                onSort={onSort}
                sortField={sortField}
                sortOrder={sortOrder}
              >
                Business
              </SortHeader>
              <SortHeader
                field="industry"
                onSort={onSort}
                sortField={sortField}
                sortOrder={sortOrder}
              >
                Industry
              </SortHeader>
              <th
                scope="col"
                aria-sort={
                  scoreSort ? (scoreSort === "asc" ? "ascending" : "descending") : undefined
                }
                className="px-4 py-3 text-left text-xs font-semibold text-white-muted uppercase select-none"
              >
                <button
                  type="button"
                  onClick={handleScoreSort}
                  className="flex cursor-pointer items-center gap-1 uppercase hover:text-white-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]/40 focus-visible:ring-offset-2"
                >
                  Score
                  <ArrowUpDown
                    className={cn(
                      "h-3 w-3",
                      scoreSort ? "text-white-primary" : "text-white-muted/50",
                    )}
                  />
                  {scoreSort && <span className="text-[10px] text-white-muted">{scoreSort}</span>}
                </button>
              </th>
              <SortHeader
                field="lead_status"
                onSort={onSort}
                sortField={sortField}
                sortOrder={sortOrder}
              >
                Status
              </SortHeader>
              <SortHeader
                field="created_at"
                onSort={onSort}
                sortField={sortField}
                sortOrder={sortOrder}
              >
                Date
              </SortHeader>
              <th scope="col" className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, index) => {
              const score = calculateLeadScore(lead);
              const scoreColor = getScoreColor(score);
              const label = getScoreLabel(score);

              return (
                <Fragment key={lead.id}>
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-border-glass hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => handleSelect(lead.id)}
                        aria-label={`Select ${lead.contact_name}`}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white-primary font-medium">{lead.contact_name}</p>
                        <Link
                          href={`/admin/contacts/${encodeURIComponent(lead.contact_email)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-white-muted hover:text-gold-light transition-colors"
                        >
                          {lead.contact_email}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white-secondary">{lead.business_name || "-"}</td>
                    <td className="px-4 py-3 text-white-secondary capitalize">
                      {lead.industry.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn("text-xs font-semibold rounded-full px-2 py-0.5", scoreColor)}
                      >
                        {label} {score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.lead_status} />
                    </td>
                    <td className="px-4 py-3 text-white-muted text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {expandedId === lead.id ? (
                        <ChevronUp className="h-4 w-4 text-white-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white-muted" />
                      )}
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {expandedId === lead.id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td colSpan={8} className="px-4 py-4 bg-bg-elevated">
                          <LeadDetail lead={lead} onUpdate={onUpdateLead} />
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState message="No leads found" icon={Users} />}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} />

      <AdminDialog
        open={enrollOpen}
        onClose={() => {
          setEnrollOpen(false);
          setEnrollCampaignId("");
        }}
        title="Enroll into a draft campaign"
      >
        <AdminSurface padding="lg" className="admin-dialog-surface space-y-4">
          <h2 className="admin-dialog-title">Enroll into a draft campaign</h2>
          <p className="text-sm text-[var(--admin-muted)]">
            {linkedContactIds().length} contact{linkedContactIds().length === 1 ? "" : "s"} will be
            staged as queued members. Staging never approves, activates, or sends.
          </p>
          {enrollError && <p role="alert">{enrollError}</p>}
          {enrollLoading ? (
            <p className="text-sm text-[var(--admin-muted)]">Loading draft campaigns…</p>
          ) : enrollError ? (
            <Button onClick={() => void openEnroll()}>Retry loading campaigns</Button>
          ) : enrollCampaigns.length === 0 ? (
            <p className="text-sm text-[var(--admin-muted)]">
              No draft campaigns. Create one in Campaigns first.
            </p>
          ) : (
            <div
              className="max-h-64 space-y-2 overflow-y-auto"
              role="radiogroup"
              aria-label="Draft campaigns"
            >
              {enrollCampaigns.map((campaign) => (
                <label
                  key={campaign.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--admin-surface-subtle)]"
                >
                  <input
                    type="radio"
                    name="enroll-campaign"
                    value={campaign.id}
                    checked={enrollCampaignId === campaign.id}
                    onChange={() => setEnrollCampaignId(campaign.id)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm text-[var(--admin-ink)]">{campaign.name}</span>
                  <span className="text-xs text-[var(--admin-muted)]">{campaign.status}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEnrollOpen(false);
                setEnrollCampaignId("");
              }}
              disabled={bulkBusy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkEnroll}
              disabled={!enrollCampaignId || bulkBusy}
            >
              {bulkBusy ? "Staging..." : "Stage enrollment"}
            </Button>
          </div>
        </AdminSurface>
      </AdminDialog>

      <AdminDialog
        open={outcome !== null}
        onClose={() => setOutcome(null)}
        title={outcome?.title ?? "Bulk operation"}
      >
        {outcome && (
          <AdminSurface padding="lg" className="admin-dialog-surface space-y-4">
            <h2 className="admin-dialog-title">{outcome.title}</h2>
            <p className="text-sm text-[var(--admin-ink)]">
              {outcome.result.applied} applied · {outcome.result.skipped} skipped ·{" "}
              {outcome.result.failed} failed
            </p>
            {outcome.result.outcomes.length > 0 && (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
                {outcome.result.outcomes.map((o) => (
                  <li key={o.contactId} className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-[var(--admin-muted)]">
                      {leads.find((lead) => lead.revenue_os?.contact_id === o.contactId)
                        ?.contact_name ?? o.contactId}
                    </span>
                    <span className="text-[var(--admin-ink)]">
                      {o.status}: {o.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setOutcome(null)}>
                Done
              </Button>
            </div>
          </AdminSurface>
        )}
      </AdminDialog>
    </div>
  );
}

interface SortHeaderProps {
  field: string;
  children: React.ReactNode;
  onSort: (field: string) => void;
  sortField: string;
  sortOrder: string;
}

function SortHeader({ field, children, onSort, sortField, sortOrder }: SortHeaderProps) {
  const active = sortField === field;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
      className="px-4 py-3 text-left text-xs font-semibold text-white-muted uppercase select-none"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex cursor-pointer items-center gap-1 uppercase hover:text-white-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]/40 focus-visible:ring-offset-2"
      >
        {children}
        <ArrowUpDown
          className={cn("h-3 w-3", active ? "text-white-primary" : "text-white-muted/50")}
        />
        {active && (
          <span className="text-[10px] text-white-muted">
            {sortOrder === "asc" ? "asc" : "desc"}
          </span>
        )}
      </button>
    </th>
  );
}
