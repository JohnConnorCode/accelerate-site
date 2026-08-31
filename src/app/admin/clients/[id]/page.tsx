"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "@/components/admin/AdminLink";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { ClientDetail } from "@/components/admin/ClientDetail";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";

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
      const data = await fetchJson<{ client?: Client | null }>(`/api/admin/clients?id=${encodeURIComponent(id)}`);
      setClient(data.client || null);

      // Fetch timeline for this client's email
      if (data.client?.contact_email) {
        const timelineData = await fetchJson<{ timeline?: TimelineItem[] }>(
          `/api/admin/contacts/timeline?email=${encodeURIComponent(data.client.contact_email)}`
        );
        setTimeline(timelineData.timeline || []);
      }
    } catch (error) {
      setClient(null);
      toast.error(error instanceof Error ? error.message : "Failed to load client");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    await fetchJson("/api/admin/clients", {
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
      <div className="space-y-4">
        <PageHeader title="Client Not Found" />
        <AdminSurface tone="subtle"><p className="text-sm text-[var(--admin-muted)]">This client does not exist or is outside the current workspace.</p></AdminSurface>
        <Link href="/admin/clients" className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--admin-ink)]">
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/clients"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
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
          <AdminSurface padding="md">
            <h4 className="mb-4 text-sm font-semibold text-[var(--admin-ink)]">
              Activity Timeline
            </h4>
            <ContactTimeline items={timeline} />
          </AdminSurface>
        </div>
      </div>
    </div>
  );
}
