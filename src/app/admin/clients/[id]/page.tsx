"use client";

import { use } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "@/components/admin/AdminLink";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { adminPageGuidance } from "@/lib/admin/page-guidance";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { ClientDetail, type Client } from "@/components/admin/ClientDetail";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { TaskQuickAdd } from "@/components/admin/TaskQuickAdd";
import { AdminRequestError, fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";

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
  const queryClient = useQueryClient();
  const clientKey = ["admin", "client", id];
  const record = useAdminQuery<{ client: Client | null }>(
    clientKey,
    `/api/admin/clients?id=${encodeURIComponent(id)}`,
    { placeholderData: undefined },
  );
  const client = record.data?.client;
  const missingClient =
    !client &&
    (record.data?.client === null ||
      (record.error instanceof AdminRequestError && record.error.status === 404));
  const email = client?.contact_email || "";
  const history = useAdminQuery<{ timeline: TimelineItem[] }>(
    ["admin", "contact-relationship", email],
    `/api/admin/contacts/timeline?email=${encodeURIComponent(email)}`,
    { enabled: Boolean(email), placeholderData: undefined },
  );
  const followups = useAdminQuery<{ tasks: Array<{ id: string; title: string; status: string }> }>(
    ["admin", "client-followups", id],
    `/api/admin/tasks?related_type=client&related_id=${encodeURIComponent(id)}`,
    { enabled: Boolean(client), placeholderData: undefined },
  );

  const refreshRelated = () => {
    void followups.refetch();
    if (email) void history.refetch();
  };
  const handleUpdate = async (data: Record<string, unknown>) => {
    const saved = await fetchJson<{ client: Client }>("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (saved.client?.id !== id) throw new Error("The server did not confirm this client update.");
    await queryClient.cancelQueries({ queryKey: clientKey, exact: true });
    queryClient.setQueryData(clientKey, saved);
    refreshRelated();
  };

  return (
    <div>
      <Link
        href="/admin/clients"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Clients
      </Link>
      <PageHeader
        title={client?.business_name || "Client"}
        subtitle={
          client?.contact_name
            ? `Customer contact: ${client.contact_name}. Review delivery progress and the next commitment for this account.`
            : "Review this client’s delivery progress, notes and outstanding commitments."
        }
        guidance={{
          ...adminPageGuidance.clients!,
          startHint:
            "Review the account and existing follow-ups before saving notes or assigning new work.",
        }}
      />
      <AdminReadBody
        loading={record.isPending}
        hasData={record.data !== undefined || missingClient}
        error={missingClient ? undefined : record.error?.message}
        refreshing={record.isFetching}
        onRetry={() => void record.refetch()}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading client"
      >
        {client ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              {email && (
                <Link
                  href={`/admin/contacts/${encodeURIComponent(email)}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--admin-ink)] underline underline-offset-4"
                >
                  Open {client.contact_name}&apos;s contact history
                </Link>
              )}
              <button
                type="button"
                disabled={record.isFetching}
                onClick={() => {
                  void record.refetch();
                  refreshRelated();
                }}
                className="admin-button admin-button--secondary"
              >
                <RefreshCw className={record.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />{" "}
                Refresh client
              </button>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ClientDetail key={client.id} client={client} onUpdate={handleUpdate} />
              </div>
              <div className="min-w-0 space-y-6">
                <AdminSurface padding="md" role="region" aria-label="Client follow-ups">
                  <h2 className="mb-3 text-sm font-semibold text-[var(--admin-ink)]">Follow-ups</h2>
                  <AdminReadBody
                    loading={followups.isPending}
                    hasData={followups.data !== undefined}
                    error={followups.error?.message}
                    refreshing={followups.isFetching}
                    onRetry={() => void followups.refetch()}
                    loadingFallback={<LoadingSkeleton variant="table" rows={2} />}
                    label="Loading follow-ups"
                  >
                    {followups.data?.tasks.length ? (
                      <ul className="divide-y divide-[var(--admin-border)]">
                        {followups.data.tasks.map((task) => (
                          <li key={task.id}>
                            <Link
                              href={`/admin/work?task=${encodeURIComponent(task.id)}`}
                              className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-[var(--admin-ink)] hover:underline"
                            >
                              <span className="min-w-0 break-words">{task.title}</span>
                              <span className="shrink-0 text-xs capitalize text-[var(--admin-muted)]">
                                {task.status}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--admin-muted)]">No follow-ups yet.</p>
                    )}
                  </AdminReadBody>
                  <TaskQuickAdd
                    key={client.id}
                    relatedType="client"
                    relatedId={client.id}
                    relatedName={client.contact_name}
                    onTaskCreated={refreshRelated}
                  />
                </AdminSurface>
                <AdminSurface padding="md" role="region" aria-label="Client activity">
                  <h2 className="mb-4 text-sm font-semibold text-[var(--admin-ink)]">Activity</h2>
                  {email ? (
                    <AdminReadBody
                      loading={history.isPending}
                      hasData={history.data !== undefined}
                      error={history.error?.message}
                      refreshing={history.isFetching}
                      onRetry={() => void history.refetch()}
                      loadingFallback={<LoadingSkeleton variant="table" rows={2} />}
                      label="Loading client activity"
                    >
                      <ContactTimeline items={history.data?.timeline || []} />
                    </AdminReadBody>
                  ) : (
                    <p className="text-sm text-[var(--admin-muted)]">
                      Add a contact email to connect this client’s activity.
                    </p>
                  )}
                </AdminSurface>
              </div>
            </div>
          </>
        ) : (
          missingClient && (
            <AdminSurface tone="subtle">
              <h2 className="text-sm font-semibold text-[var(--admin-ink)]">Client not found</h2>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">
                This client does not exist in the current workspace.
              </p>
            </AdminSurface>
          )
        )}
      </AdminReadBody>
    </div>
  );
}
