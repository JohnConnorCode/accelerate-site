"use client";

import { useEffect } from "react";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CircleAlert, Sparkles, User } from "lucide-react";
import Link from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { CollectionCaseLinks } from "@/components/admin/CollectionsWorkspace";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";

interface TimelineItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  sourceId: string;
  link: string;
}

interface CanonicalProfile {
  schemaReady: boolean;
  status: "connected" | "unlinked" | "ambiguous" | "degraded";
  contact: {
    id: string;
    full_name: string;
    primary_email: string | null;
    lifecycle_stage: string;
    communication_status: string;
    next_action: string | null;
    next_action_at: string | null;
  } | null;
  company: { id: string; name: string; domain: string | null; industry: string | null } | null;
  opportunities: Array<{
    id: string;
    name: string;
    stage: string;
    estimated_value: number;
    won_value: number;
  }>;
  work?: {
    available: boolean;
    items: Array<{
      id: string;
      title: string;
      status: string;
      due_date: string | null;
      priority: string;
    }>;
  };
  conversations?: {
    available: boolean;
    items: Array<{
      id: string;
      channel: string;
      subject: string | null;
      status: string;
      last_message_at: string | null;
    }>;
  };
}

export default function ContactTimelinePage() {
  const params = useParams();
  const identifier = decodeURIComponent(params.email as string);
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const relationship = useAdminQuery<{
    timeline?: TimelineItem[];
    canonical?: CanonicalProfile | null;
  }>(
    ["admin", "contact-relationship", identifier],
    `/api/admin/contacts/timeline?${isId ? "id" : "email"}=${encodeURIComponent(identifier)}`,
    // Never show the previous person's relationship while a different record loads.
    { placeholderData: undefined },
  );
  const timeline = relationship.data?.timeline ?? [];
  const canonical = relationship.data?.canonical ?? null;
  const contact = canonical?.contact ?? null;
  const recordName = contact?.full_name || (isId ? "Contact" : identifier);
  const refetch = relationship.refetch;

  useEffect(() => {
    const refresh = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.id === contact?.id) void refetch();
    };
    window.addEventListener("admin:refresh-contact", refresh);
    return () => window.removeEventListener("admin:refresh-contact", refresh);
  }, [contact?.id, refetch]);

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-4">
        <Link
          href="/admin/contacts"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--admin-muted)] transition-[background-color,color,scale] hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.97] dark:hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to contacts
        </Link>
      </div>

      <PageHeader
        title={recordName}
        subtitle="Next step, open work, conversations, and history in one place."
      />
      <AdminReadBody
        loading={relationship.isPending}
        hasData={relationship.data !== undefined}
        error={relationship.error?.message}
        refreshing={relationship.isFetching && !relationship.isPending}
        onRetry={() => void relationship.refetch()}
        loadingFallback={<LoadingSkeleton variant="page" />}
        label="Loading contact relationship"
      >
        <AdminSurface padding="md" className="mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]">
                <User className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--admin-ink)]">
                  {contact?.primary_email || recordName}
                </p>
                <p className="admin-copy text-xs">
                  {timeline.length} interaction{timeline.length !== 1 ? "s" : ""} found
                  {canonical?.status === "connected" ? " · Linked record" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {contact && (
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("admin:open-ai", {
                        detail: {
                          prompt: `Summarize contact ${contact.id}, citing the current record and recent activity. What is the next useful step?`,
                        },
                      }),
                    )
                  }
                >
                  <Sparkles className="size-4" aria-hidden="true" /> Ask about contact
                </button>
              )}
              {contact && (
                <button
                  type="button"
                  className="admin-button admin-button--primary"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("admin:add-task", {
                        detail: { contactId: contact.id, contactName: contact.full_name },
                      }),
                    )
                  }
                >
                  Add follow-up
                </button>
              )}
              {canonical?.status !== "connected" && (
                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <CircleAlert className="h-3.5 w-3.5" />{" "}
                  {canonical?.status === "ambiguous"
                    ? "Identity review needed"
                    : canonical?.status === "degraded"
                      ? "Revenue OS unavailable"
                      : "Not linked yet"}
                </span>
              )}
            </div>
          </div>
        </AdminSurface>

        {contact && canonical && (
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <AdminSurface padding="md" elevation="flat" className="lg:col-span-1">
              <h2 className="text-sm font-semibold text-[var(--admin-ink)]">Next step</h2>
              <p className="mt-3 text-sm font-medium text-[var(--admin-ink)]">
                {contact.next_action || "No next step recorded"}
              </p>
              {contact.next_action_at && (
                <p className="mt-1 text-xs text-[var(--admin-muted)]">
                  Due {new Date(contact.next_action_at).toLocaleDateString()}
                </p>
              )}
              <p className="mt-3 text-xs capitalize text-[var(--admin-muted)]">
                {contact.lifecycle_stage.replaceAll("_", " ")} ·{" "}
                {contact.communication_status.replaceAll("_", " ")}
              </p>
              {canonical.company && (
                <p className="mt-2 text-xs text-[var(--admin-muted)]">
                  Company: {canonical.company.name}
                </p>
              )}
            </AdminSurface>
            <AdminSurface padding="md" elevation="flat">
              <h2 className="text-sm font-semibold text-[var(--admin-ink)]">Open work</h2>
              {canonical.work?.available === false ? (
                <p className="mt-3 text-sm text-[var(--admin-muted)]">
                  Work is unavailable right now.
                </p>
              ) : canonical.work?.items.length ? (
                <ul className="mt-2 divide-y divide-[var(--admin-border)]">
                  {canonical.work.items.map((item) => (
                    <li key={item.id} className="py-2">
                      <Link
                        href={`/admin/work?task=${item.id}`}
                        className="text-sm font-medium text-[var(--admin-ink)] hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-0.5 text-xs capitalize text-[var(--admin-muted)]">
                        {item.status.replaceAll("_", " ")}
                        {item.due_date
                          ? ` · Due ${new Date(item.due_date).toLocaleDateString()}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--admin-muted)]">
                  No open work in recent tasks.
                </p>
              )}
            </AdminSurface>
            <AdminSurface padding="md" elevation="flat">
              <h2 className="text-sm font-semibold text-[var(--admin-ink)]">Conversations</h2>
              {canonical.conversations?.available === false ? (
                <p className="mt-3 text-sm text-[var(--admin-muted)]">
                  Conversations are unavailable right now.
                </p>
              ) : canonical.conversations?.items.length ? (
                <ul className="mt-2 divide-y divide-[var(--admin-border)]">
                  {canonical.conversations.items.map((item) => (
                    <li key={item.id} className="py-2">
                      <Link
                        href={`/admin/conversations?thread=${encodeURIComponent(item.id)}`}
                        className="text-sm font-medium text-[var(--admin-ink)] hover:underline"
                      >
                        {item.subject || `${item.channel} conversation`}
                      </Link>
                      <p className="mt-0.5 text-xs capitalize text-[var(--admin-muted)]">
                        {item.status.replaceAll("_", " ")}
                        {item.last_message_at
                          ? ` · ${new Date(item.last_message_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--admin-muted)]">No linked conversations.</p>
              )}
            </AdminSurface>
          </div>
        )}
        {!!canonical?.opportunities?.length && (
          <AdminSurface padding="md" elevation="flat" className="mb-5">
            <h2 className="text-sm font-semibold text-[var(--admin-ink)]">Opportunities</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {canonical.opportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  href={`/admin/pipeline/${encodeURIComponent(opportunity.id)}`}
                  className="admin-button admin-button--secondary"
                >
                  {opportunity.name || "Opportunity"} · {opportunity.stage.replaceAll("_", " ")}
                </Link>
              ))}
            </div>
          </AdminSurface>
        )}
        <div className="space-y-5">
          {canonical?.contact && <CollectionCaseLinks contactId={canonical.contact.id} />}
          <ContactTimeline items={timeline} />
        </div>
      </AdminReadBody>
    </motion.div>
  );
}
