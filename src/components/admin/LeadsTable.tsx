"use client";

import { useState, Fragment, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  ArrowUpDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateLeadScore, getScoreColor, getScoreLabel } from "@/lib/admin/lead-scoring";
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
}

interface LeadsTableProps {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
  onUpdateLead: (id: string, data: { lead_status?: string; notes?: string; estimated_value?: number }) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  sortField: string;
  sortOrder: string;
}

const statusOptions = ["new", "contacted", "qualified", "proposal", "won", "lost"];

export function LeadsTable({
  leads,
  total,
  page,
  totalPages,
  onUpdateLead,
  onPageChange,
  onSort,
  sortField,
  sortOrder,
}: LeadsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [scoreSort, setScoreSort] = useState<"asc" | "desc" | null>(null);

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

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    try {
      await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), lead_status: bulkStatus }),
      });
      selectedIds.forEach((id) => onUpdateLead(id, { lead_status: bulkStatus }));
      setSelectedIds(new Set());
      setBulkStatus("");
    } catch {
      // silent
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
            <GlassCard padding="sm" hover="none" className="flex items-center gap-3 mb-3">
              <span className="text-sm text-white-secondary">
                {selectedIds.size} selected
              </span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="rounded-lg glass px-3 py-1.5 text-sm text-white-primary bg-transparent focus:outline-none"
              >
                <option value="">Change status to...</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" onClick={handleBulkUpdate} disabled={!bulkStatus}>
                Apply
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={handleSelectAll}
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
                className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase cursor-pointer hover:text-white-secondary select-none"
                onClick={handleScoreSort}
              >
                <span className="flex items-center gap-1">
                  Score
                  <ArrowUpDown
                    className={cn("h-3 w-3", scoreSort ? "text-white-primary" : "text-white-muted/50")}
                  />
                  {scoreSort && (
                    <span className="text-[10px] text-white-muted">{scoreSort}</span>
                  )}
                </span>
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
              <th className="px-4 py-3 w-10"></th>
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
                    onClick={() =>
                      setExpandedId(expandedId === lead.id ? null : lead.id)
                    }
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => handleSelect(lead.id)}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white-primary font-medium">
                          {lead.contact_name}
                        </p>
                        <Link
                          href={`/admin/contacts/${encodeURIComponent(lead.contact_email)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-white-muted hover:text-[var(--gold-light)] transition-colors"
                        >
                          {lead.contact_email}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white-secondary">
                      {lead.business_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-white-secondary capitalize">
                      {lead.industry.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-semibold rounded-full px-2 py-0.5", scoreColor)}>
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
        {filtered.length === 0 && (
          <EmptyState message="No leads found" icon={Users} />
        )}
      </GlassCard>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
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

function SortHeader({
  field,
  children,
  onSort,
  sortField,
  sortOrder,
}: SortHeaderProps) {
  const active = sortField === field;
  return (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase cursor-pointer hover:text-white-secondary select-none"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown
          className={cn("h-3 w-3", active ? "text-white-primary" : "text-white-muted/50")}
        />
        {active && (
          <span className="text-[10px] text-white-muted">
            {sortOrder === "asc" ? "asc" : "desc"}
          </span>
        )}
      </span>
    </th>
  );
}
