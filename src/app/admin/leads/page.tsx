"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { LeadsTable } from "@/components/admin/LeadsTable";

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
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        sort: sortField,
        order: sortOrder,
      });
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
  }, [page, sortField, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleUpdateLead = async (
    id: string,
    data: { lead_status?: string; notes?: string }
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
      />

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
