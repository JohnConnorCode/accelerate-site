"use client";

import { useEffect, useState, useCallback, use } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { ClientDetail } from "@/components/admin/ClientDetail";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { GlassCard } from "@/components/ui/GlassCard";

interface Client {
  id: string;
  lead_id: string | null;
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  industry: string | null;
  status: string;
  monthly_value: number;
  one_time_value: number;
  contract_start: string | null;
  contract_end: string | null;
  services: string[];
  onboarding_checklist: { label: string; done: boolean }[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TimelineItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  sourceId: string;
  link: string;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients?id=${id}`);
      const data = await res.json();
      setClient(data.client || null);

      // Fetch timeline for this client's email
      if (data.client?.contact_email) {
        const timelineRes = await fetch(
          `/api/admin/contacts/timeline?email=${encodeURIComponent(data.client.contact_email)}`
        );
        const timelineData = await timelineRes.json();
        setTimeline(timelineData.timeline || []);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchClient();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Client" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader title="Client Not Found" />
        <p className="text-white-muted">This client does not exist.</p>
        <Link href="/admin/clients" className="text-[var(--gold-light)] text-sm mt-2 inline-block">
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-4">
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-xs text-white-muted hover:text-white-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Clients
        </Link>
      </div>

      <PageHeader
        title={client.business_name}
        subtitle={client.contact_name}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ClientDetail client={client} onUpdate={handleUpdate} />
        </div>
        <div>
          <GlassCard hover="none" padding="md">
            <h4 className="font-display text-sm font-semibold text-white-primary mb-4">
              Activity Timeline
            </h4>
            <ContactTimeline items={timeline} />
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}
