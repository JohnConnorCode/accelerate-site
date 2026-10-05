"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "@/components/admin/AdminLink";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { ClientDetail } from "@/components/admin/ClientDetail";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminRequestError, fetchJson } from "@/lib/admin/fetchJson";

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
  const [clientRead, setClientRead] = useState<{
    id: string;
    data: Client | null;
    error: string;
  } | null>(null);
  const currentClientRead = clientRead?.id === id ? clientRead : null;
  const client = currentClientRead?.data || null;
  const error = currentClientRead?.error || "";
  const [timeline, setTimeline] = useState<{
    clientId: string;
    items: TimelineItem[] | null;
    error: string;
  } | null>(null);
  const currentTimelineRead = timeline?.clientId === id ? timeline : null;
  const currentTimeline = currentTimelineRead?.items || null;
  const timelineError = currentTimelineRead?.error || "";
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const clientRequest = useRef(0);
  const timelineRequest = useRef(0);

  const fetchTimeline = useCallback(async (target: Client) => {
    const version = ++timelineRequest.current;
    setTimelineLoading(true);
    try {
      const data = target.contact_email
        ? await fetchJson<{ timeline: TimelineItem[] }>(
            `/api/admin/contacts/timeline?email=${encodeURIComponent(target.contact_email)}`,
          )
        : { timeline: [] };
      if (version !== timelineRequest.current) return;
      if (!Array.isArray(data.timeline)) throw new Error("The activity response is incomplete.");
      setTimeline({ clientId: target.id, items: data.timeline, error: "" });
    } catch (cause) {
      if (version === timelineRequest.current)
        setTimeline((previous) => ({
          clientId: target.id,
          items: previous?.clientId === target.id ? previous.items : null,
          error: cause instanceof Error ? cause.message : "Activity could not load.",
        }));
    } finally {
      if (version === timelineRequest.current) setTimelineLoading(false);
    }
  }, []);

  const fetchClient = useCallback(async () => {
    const version = ++clientRequest.current;
    setLoading(true);
    try {
      const data = await fetchJson<{ client: Client | null }>(
        `/api/admin/clients?id=${encodeURIComponent(id)}`,
      );
      if (version !== clientRequest.current) return;
      if (data.client === undefined || (data.client && data.client.id !== id))
        throw new Error("The client response is incomplete.");
      setClientRead({ id, data: data.client, error: "" });
      if (data.client) void fetchTimeline(data.client);
      else ++timelineRequest.current;
    } catch (cause) {
      if (version !== clientRequest.current) return;
      if (cause instanceof AdminRequestError && cause.status === 404) {
        setClientRead({ id, data: null, error: "" });
        ++timelineRequest.current;
      } else
        setClientRead((previous) => ({
          id,
          data: previous?.id === id ? previous.data : null,
          error: cause instanceof Error ? cause.message : "Client could not load.",
        }));
    } finally {
      if (version === clientRequest.current) setLoading(false);
    }
  }, [id, fetchTimeline]);

  const invalidateRequests = useCallback(() => {
    ++clientRequest.current;
    ++timelineRequest.current;
  }, []);
  useEffect(() => {
    void fetchClient();
    return invalidateRequests;
  }, [fetchClient, invalidateRequests]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    await fetchJson("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchClient();
  };

  if (!client && (loading || !currentClientRead || error)) {
    return (
      <div>
        <PageHeader title="Client" />
        <AdminReadBody
          loading={loading || !currentClientRead}
          hasData={false}
          error={error}
          refreshing={loading}
          onRetry={() => void fetchClient()}
          loadingFallback={<LoadingSkeleton variant="page" />}
          label="Loading client"
        >
          <span />
        </AdminReadBody>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <PageHeader title="Client Not Found" />
        <AdminSurface tone="subtle">
          <p className="text-sm text-[var(--admin-muted)]">
            This client does not exist or is outside the current workspace.
          </p>
        </AdminSurface>
        <Link
          href="/admin/clients"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--admin-ink)]"
        >
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

      <PageHeader title={client.business_name} subtitle={client.contact_name} />
      <AdminReadBody
        loading={loading}
        hasData={Boolean(client)}
        error={error}
        refreshing={loading}
        onRetry={() => void fetchClient()}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading client"
      >
        <Link
          href={`/admin/contacts/${encodeURIComponent(client.contact_email)}`}
          className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-[var(--admin-ink)] underline underline-offset-4"
        >
          Open {client.contact_name}&apos;s contact history
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ClientDetail client={client} onUpdate={handleUpdate} />
          </div>
          <div>
            <AdminSurface padding="md">
              <h4 className="mb-4 text-sm font-semibold text-[var(--admin-ink)]">
                Activity Timeline
              </h4>
              <AdminReadBody
                loading={timelineLoading || (!currentTimeline && !timelineError)}
                hasData={currentTimeline !== null}
                error={timelineError}
                refreshing={timelineLoading}
                onRetry={() => void fetchTimeline(client)}
                loadingFallback={<LoadingSkeleton variant="detail" />}
                label="Loading client activity"
              >
                <ContactTimeline items={currentTimeline || []} />
              </AdminReadBody>
            </AdminSurface>
          </div>
        </div>
      </AdminReadBody>
    </div>
  );
}
