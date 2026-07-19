"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, X, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { LeadsTable } from "@/components/admin/LeadsTable";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { AddLeadModal } from "@/components/admin/AddLeadModal";
import { Button } from "@/components/ui/Button";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import {
  loadLastFilters,
  saveLastFilters,
  loadSavedViews,
  addSavedView,
  removeSavedView,
  type LeadsFilterState,
  type SavedLeadsView,
} from "@/lib/admin/leadsViews";

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

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const industryOptions = [
  { value: "all", label: "All Industries" },
  { value: "law_firm", label: "Law Firm" },
  { value: "real_estate", label: "Real Estate" },
  { value: "professional_services", label: "Professional Services" },
  { value: "healthcare", label: "Healthcare" },
  { value: "home_services", label: "Home Services" },
  { value: "financial_services", label: "Financial Services" },
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedLeadsView[]>([]);
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState("");
  const hydratedRef = useRef(false);

  // Restore persisted filters + saved views once, on mount (SSR-safe).
  useEffect(() => {
    const last = loadLastFilters();
    setStatusFilter(last.statusFilter);
    setIndustryFilter(last.industryFilter);
    setDateFrom(last.dateFrom);
    setDateTo(last.dateTo);
    setSortField(last.sortField);
    setSortOrder(last.sortOrder);
    setSavedViews(loadSavedViews());
    hydratedRef.current = true;
  }, []);

  // Persist filter/sort state whenever it changes (after hydration).
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveLastFilters({ statusFilter, industryFilter, dateFrom, dateTo, sortField, sortOrder });
  }, [statusFilter, industryFilter, dateFrom, dateTo, sortField, sortOrder]);

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        sort: sortField,
        order: sortOrder,
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (industryFilter !== "all") params.set("industry", industryFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const data = await fetchJson<{ leads?: Lead[]; total?: number; totalPages?: number }>(
        `/api/admin/leads?${params}`,
      );
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortOrder, statusFilter, industryFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Open the New Lead modal when triggered by the `n` keyboard shortcut.
  useEffect(() => {
    const open = () => setShowAddLead(true);
    window.addEventListener("admin:new-lead", open);
    return () => window.removeEventListener("admin:new-lead", open);
  }, []);

  const handleUpdateLead = async (
    id: string,
    data: { lead_status?: string; notes?: string; estimated_value?: number }
  ) => {
    try {
      await fetchJson("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      toast.success("Lead updated");
      await fetchLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update lead");
    }
  };

  const handleBulkStatus = async (ids: string[], status: string) => {
    try {
      await fetchJson("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, lead_status: status }),
      });
      toast.success(`${ids.length} lead${ids.length === 1 ? "" : "s"} updated`);
      await fetchLeads();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update leads");
      return false;
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await fetchJson("/api/admin/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      toast.success(`${ids.length} lead${ids.length === 1 ? "" : "s"} deleted`);
      await fetchLeads();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete leads");
      return false;
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const applyView = (filters: LeadsFilterState) => {
    setStatusFilter(filters.statusFilter);
    setIndustryFilter(filters.industryFilter);
    setDateFrom(filters.dateFrom);
    setDateTo(filters.dateTo);
    setSortField(filters.sortField);
    setSortOrder(filters.sortOrder);
    setPage(1);
  };

  const handleSaveView = () => {
    const name = viewName.trim();
    if (!name) return;
    setSavedViews(
      addSavedView(name, { statusFilter, industryFilter, dateFrom, dateTo, sortField, sortOrder }),
    );
    setViewName("");
    setShowSaveView(false);
    toast.success(`Saved view "${name}"`);
  };

  const handleRemoveView = (id: string) => {
    setSavedViews(removeSavedView(id));
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Leads" />
        <LoadingSkeleton variant="table" count={8} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Leads"
        subtitle={`${total} total`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowAddLead(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Lead
          </Button>
        }
      />

      <AddLeadModal
        isOpen={showAddLead}
        onClose={() => setShowAddLead(false)}
        onLeadCreated={() => fetchLeads()}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-gold transition-all"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={industryFilter}
          onChange={(e) => { setIndustryFilter(e.target.value); setPage(1); }}
          className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-gold transition-all"
        >
          {industryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(v) => { setDateFrom(v); setPage(1); }}
          onDateToChange={(v) => { setDateTo(v); setPage(1); }}
        />
      </div>

      {/* Saved views */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {savedViews.map((view) => (
          <span
            key={view.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-bg-subtle border border-border-glass pl-3 pr-1 py-1 text-xs text-white-secondary"
          >
            <button
              type="button"
              onClick={() => applyView(view.filters)}
              className="hover:text-white-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-base)] rounded cursor-pointer"
            >
              {view.name}
            </button>
            <button
              type="button"
              onClick={() => handleRemoveView(view.id)}
              aria-label={`Remove view ${view.name}`}
              className="text-white-muted hover:text-red-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-base)] cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {showSaveView ? (
          <span className="inline-flex items-center gap-1">
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveView();
                if (e.key === "Escape") { setShowSaveView(false); setViewName(""); }
              }}
              placeholder="View name"
              autoFocus
              className="rounded-lg bg-bg-subtle border border-border-glass px-2.5 py-1 text-xs text-white-primary focus:outline-none focus:border-gold transition-all placeholder:text-white-muted w-32"
            />
            <button
              type="button"
              onClick={handleSaveView}
              disabled={!viewName.trim()}
              className="text-xs text-gold-light hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-base)] cursor-pointer px-1"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setShowSaveView(false); setViewName(""); }}
              aria-label="Cancel saving view"
              className="text-white-muted hover:text-white-primary transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-base)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowSaveView(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-glass px-3 py-1 text-xs text-white-muted hover:text-white-secondary hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-base)] cursor-pointer"
          >
            <Save className="h-3 w-3" />
            Save current view
          </button>
        )}
      </div>

      <LeadsTable
        leads={leads}
        total={total}
        page={page}
        totalPages={totalPages}
        onUpdateLead={handleUpdateLead}
        onBulkStatus={handleBulkStatus}
        onBulkDelete={handleBulkDelete}
        onPageChange={setPage}
        onSort={handleSort}
        sortField={sortField}
        sortOrder={sortOrder}
      />
    </motion.div>
  );
}
