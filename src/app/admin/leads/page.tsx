"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { LeadsTable } from "@/components/admin/LeadsTable";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { AddLeadModal } from "@/components/admin/AddLeadModal";
import { Button } from "@/components/ui/Button";

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

      const res = await fetch(`/api/admin/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortOrder, statusFilter, industryFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleUpdateLead = async (
    id: string,
    data: { lead_status?: string; notes?: string; estimated_value?: number }
  ) => {
    try {
      await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      await fetchLeads();
    } catch {
      // Handle error silently
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
          className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-glass)] px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-[var(--gold-base)] transition-all"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={industryFilter}
          onChange={(e) => { setIndustryFilter(e.target.value); setPage(1); }}
          className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-glass)] px-3 py-1.5 text-sm text-white-primary focus:outline-none focus:border-[var(--gold-base)] transition-all"
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

      <LeadsTable
        leads={leads}
        total={total}
        page={page}
        totalPages={totalPages}
        onUpdateLead={handleUpdateLead}
        onPageChange={setPage}
        onSort={handleSort}
        sortField={sortField}
        sortOrder={sortOrder}
      />
    </motion.div>
  );
}
