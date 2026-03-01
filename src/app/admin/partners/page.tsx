"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
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

  if (loading) {
    return (
      <div>
        <PageHeader title="Partner Applications" />
        <LoadingSkeleton variant="table" />
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
        title="Partner Applications"
        actions={
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "declined", label: "Declined" },
            ]}
            className="w-40"
          />
        }
      />

      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner, index) => (
              <motion.tr
                key={partner.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border-glass hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-white-primary font-medium">{partner.name}</p>
                    <p className="text-xs text-white-muted">{partner.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-white-secondary">
                  {partner.company}
                  {partner.website && (
                    <p className="text-xs text-white-muted">{partner.website}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-white-secondary capitalize">
                  {partner.partner_type}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={partner.status} />
                </td>
                <td className="px-4 py-3 text-white-muted text-xs">
                  {new Date(partner.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {partner.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStatusChange(partner.id, "approved")}
                        className="text-emerald-300 text-xs px-2 py-1"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStatusChange(partner.id, "declined")}
                        className="text-red-300 text-xs px-2 py-1"
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
        <Toast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} />
      )}
    </motion.div>
  );
}
