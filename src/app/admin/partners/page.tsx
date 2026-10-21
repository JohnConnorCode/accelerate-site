"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { EmptyState } from "@/components/admin/EmptyState";
import { Toast } from "@/components/ui/Toast";

interface Partner {
  id: string;
  name: string;
  email: string;
  company: string;
  website?: string;
  partner_type: string;
  message: string;
  status: string;
  created_at: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/partners?${params}`);
      const data = await res.json();
      setPartners(data.partners || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: `Partner ${status}`, type: "success" });
      await fetchData();
    } catch {
      setToast({ message: "Failed to update status", type: "error" });
    }
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader title={adminPageName("partners")} />
      <div className="mb-4 w-48">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          options={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "declined", label: "Declined" },
          ]}
        />
      </div>
      <AdminReadBody
        loading={loading}
        hasData={!loading || partners.length > 0}
        onRetry={() => {
          setLoading(true);
          void fetchData();
        }}
        loadingFallback={<LoadingSkeleton variant="table" />}
        label="Loading partner applications"
      >
        <GlassCard padding="none" hover="none" className="overflow-clip">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner, index) => (
                <motion.tr
                  key={partner.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <td>
                    <div>
                      <p className="text-[var(--admin-ink)] font-medium">{partner.name}</p>
                      <p className="text-xs text-[var(--admin-muted)]">{partner.email}</p>
                    </div>
                  </td>
                  <td className="text-[var(--admin-muted)]">
                    {partner.company}
                    {partner.website && (
                      <p className="text-xs text-[var(--admin-muted)]">{partner.website}</p>
                    )}
                  </td>
                  <td className="text-[var(--admin-muted)] capitalize">{partner.partner_type}</td>
                  <td>
                    <StatusBadge status={partner.status} />
                  </td>
                  <td className="text-[var(--admin-muted)] text-xs">
                    {new Date(partner.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {partner.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStatusChange(partner.id, "approved")}
                          className="text-xs"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStatusChange(partner.id, "declined")}
                          className="text-xs text-[var(--admin-danger)]"
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {partners.length === 0 && (
            <EmptyState message="No partner applications yet" icon={Handshake} />
          )}
        </GlassCard>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            isVisible={true}
            onClose={() => setToast(null)}
          />
        )}
      </AdminReadBody>
    </motion.div>
  );
}
