"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/admin/AdminLink";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Download,
  Inbox,
  Loader2,
  Mail,
  Phone,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { ContactIntakeNav } from "@/components/admin/ContactIntakeNav";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { CanonicalSourceLink } from "@/components/admin/CanonicalSourceLink";
import { SourceToolDispositions } from "@/components/admin/SourceToolDispositions";
import { Toast } from "@/components/ui/Toast";
import { adminListItemVariants, adminListVariants } from "@/lib/admin/motion";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import type { SourceFieldDisposition } from "@/lib/revenue-os/retained-source-dispositions";

type Contact = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  business_type?: string;
  business_name?: string;
  message: string;
  created_at: string;
  revenue_os?: {
    contact_id: string | null;
    opportunity_id: string | null;
    stage: string | null;
    linked_by: "source" | "identity" | "email" | null;
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const router = useAdminNavigation();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const dismissedContactRef = useRef<string | null>(null);
  const contactTriggerRef = useRef<HTMLElement | null>(null);

  const contactsQuery = useAdminQuery<{
    contacts?: Contact[];
    total?: number;
    totalPages?: number;
    canonicalSchemaReady?: boolean;
    dispositions?: SourceFieldDisposition[];
  }>(["admin", "contacts", page], `/api/admin/contacts?page=${page}`);
  const contacts = useMemo(
    () => contactsQuery.data?.contacts ?? [],
    [contactsQuery.data?.contacts],
  );
  const total = contactsQuery.data?.total ?? 0;
  const totalPages = contactsQuery.data?.totalPages ?? 1;
  const loading = contactsQuery.isPending;
  useEffect(() => {
    const requestedContact = searchParams.get("contact")?.trim();
    if (!requestedContact) {
      dismissedContactRef.current = null;
      return;
    }
    if (dismissedContactRef.current !== requestedContact) {
      setExpandedId(requestedContact);
      setContactOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(
    () =>
      contacts.filter((contact) => {
        const query = searchQuery.trim().toLowerCase();
        if (
          query &&
          !`${contact.name} ${contact.email} ${contact.business_name || ""} ${contact.business_type || ""}`
            .toLowerCase()
            .includes(query)
        )
          return false;
        if (dateFrom && new Date(contact.created_at) < new Date(`${dateFrom}T00:00:00`))
          return false;
        if (dateTo && new Date(contact.created_at) >= new Date(`${dateTo}T23:59:59.999`))
          return false;
        return true;
      }),
    [contacts, dateFrom, dateTo, searchQuery],
  );
  const rows = directory.data?.contacts ?? [];
  const selected = rows.find((contact) => contact.id === editing);
  const open = (contact?: Contact) => {
    setEditing(contact?.id ?? "new");
    setDraft(
      contact
        ? {
            fullName: contact.full_name,
            email: contact.primary_email ?? "",
            phone: contact.phone ?? "",
            title: contact.title ?? "",
            lifecycleStage: contact.lifecycle_stage,
            nextAction: contact.next_action ?? "",
            nextActionAt: contact.next_action_at?.slice(0, 16) ?? "",
          }
        : empty,
    );
    setError("");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/admin/contacts/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing !== "new" ? { id: editing } : {}),
          ...(editing !== "new" ? { updatedAt: selected?.updated_at } : {}),
          fullName: draft.fullName,
          email: draft.email || null,
          phone: draft.phone || null,
          title: draft.title || null,
          lifecycleStage: draft.lifecycleStage,
          nextAction: draft.nextAction || null,
          nextActionAt: draft.nextActionAt ? new Date(draft.nextActionAt).toISOString() : null,
        }),
      });
      if (!response.ok) throw new Error("Delete failed");
      await contactsQuery.refetch();
      setExpandedId(null);
      setContactOpen(false);
      setToast({ message: "Submission deleted", type: "success" });
    } catch {
      setToast({ message: "Submission could not be deleted", type: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Contacts"
        subtitle="Find and manage every person in your workspace."
        actions={
          <button
            type="button"
            className="admin-button admin-button--primary"
            onClick={() => open()}
          >
            Add contact
          </button>
        }
      />
      <ContactIntakeNav active="submissions" />
      <AdminReadBody
        loading={loading}
        hasData={Boolean(contactsQuery.data)}
        error={contactsQuery.error?.message}
        onRetry={() => void contactsQuery.refetch()}
        refreshing={contactsQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="table" />}
        label="Loading contact submissions"
      >
        <AdminSurface padding="none" className="overflow-hidden">
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <div>
              <p className="admin-eyebrow">Website submissions</p>
              <h2 className="mt-1 text-balance font-display text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">
                Incoming contact requests
              </h2>
              <p className="admin-copy mt-1 text-xs">
                <span className="tabular-nums">{total}</span> captured through the website form
              </p>
            </div>
            <div
              className="admin-toolbar admin-toolbar--filters"
              role="search"
              aria-label="Submission filters"
            >
              <div className="admin-toolbar-field admin-toolbar-search">
                <label className="admin-field-label" htmlFor="submission-search">
                  Search submissions
                </label>
                <input
                  id="submission-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, email, or company"
                  className="admin-field"
                />
              </div>
              <div
                className="admin-toolbar-date-range"
                role="group"
                aria-label="Submission date range"
              >
                <label className="admin-field-label">
                  <span>From</span>
                  <input
                    aria-label="From date"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="admin-field [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </label>
                <label className="admin-field-label">
                  <span>To</span>
                  <input
                    aria-label="To date"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="admin-field [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </label>
              </div>
              {(searchQuery || dateFrom || dateTo) && (
                <button
                  type="button"
                  className="admin-button admin-button-secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton variant="table" />
          ) : filtered.length === 0 ? (
            <div className="border-t border-[var(--admin-border)]">
              <EmptyState
                title={
                  contacts.length
                    ? "No submissions match these filters"
                    : "No website submissions yet"
                }
                description={
                  contacts.length
                    ? "Clear the search or date range to return to the full intake."
                    : "New website contact requests will appear here. You can still add an external list through the reviewed import flow."
                }
                icon={Inbox}
                actionLabel={contacts.length ? "Clear filters" : "Import a contact list"}
                actionHref={contacts.length ? undefined : "/admin/contact-imports"}
                onAction={
                  contacts.length
                    ? () => {
                        setSearchQuery("");
                        setDateFrom("");
                        setDateTo("");
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <motion.div
              variants={adminListVariants}
              initial={false}
              animate="visible"
              className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]"
            >
              {filtered.map((contact) => {
                return (
                  <motion.article key={contact.id} variants={adminListItemVariants}>
                    <button
                      type="button"
                      onClick={(event) => openContact(contact.id, event.currentTarget)}
                      className="admin-record-row group grid min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-[background-color,box-shadow,transform] duration-150 hover:bg-black/[0.022] hover:shadow-[inset_3px_0_0_var(--admin-ink)] active:scale-[0.995] dark:hover:bg-white/[0.025] sm:px-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)_minmax(0,1.2fr)_auto]"
                      aria-haspopup="dialog"
                      data-contact-row-toggle={contact.id}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--admin-ink)]">
                          {contact.name}
                        </span>
                        <span className="admin-copy mt-0.5 block truncate text-xs">
                          {contact.email}
                        </span>
                        <span className="mt-1 block">
                          <CanonicalSourceLink
                            link={contact.revenue_os}
                            schemaReady={contactsQuery.data?.canonicalSchemaReady}
                          />
                        </span>
                      </span>
                      <span className="admin-copy hidden truncate text-xs md:block">
                        {contact.business_name || contact.business_type || "No company supplied"}
                      </span>
                      <span className="admin-copy hidden truncate text-xs md:block">
                        {contact.message || "No message supplied"}
                      </span>
                      <span className="flex items-center justify-between gap-3 md:justify-end">
                        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.07em] text-[var(--admin-muted)]">
                          {formatDate(contact.created_at)}
                        </span>
                        <ChevronRight className="size-4 text-[var(--admin-muted)] transition-transform duration-150 group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </AdminSurface>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="admin-copy text-xs">
              Page <span className="tabular-nums">{page}</span> of{" "}
              <span className="tabular-nums">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="min-h-10 rounded-[var(--admin-control-radius)] px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="min-h-10 rounded-[var(--admin-control-radius)] px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
        <SourceToolDispositions
          schemaReady={contactsQuery.data?.canonicalSchemaReady}
          dispositions={contactsQuery.data?.dispositions}
        />
      </AdminReadBody>
      <AdminDialog
        open={contactOpen && Boolean(displayedContact)}
        onClose={closeContact}
        title={`${displayedContact?.name || "Contact"} contact details`}
        labelledBy="contact-detail-title"
        maxWidth="lg"
      >
        {displayedContact && (
          <div className="admin-dialog-surface max-h-[92dvh] w-full overflow-y-auto bg-[var(--admin-surface)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-[var(--admin-control-radius)] bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]">
                  <UserRound className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="admin-eyebrow">Contact intake</p>
                  <h2
                    id="contact-detail-title"
                    className="mt-1 truncate text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]"
                  >
                    {displayedContact.name}
                  </h2>
                  <p className="admin-copy mt-0.5 truncate text-xs">
                    Received {formatDate(displayedContact.created_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeContact}
                aria-label="Close contact details"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-5 px-5 py-5 sm:px-6">
              <dl className="grid gap-3 rounded-[var(--admin-surface-radius)] bg-[var(--admin-surface-subtle)] p-4 shadow-[var(--admin-shadow-border)] sm:grid-cols-2">
                <div>
                  <dt className="admin-eyebrow">Email</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-[var(--admin-ink)]">
                    {displayedContact.email}
                  </dd>
                </div>
                <div>
                  <dt className="admin-eyebrow">Phone</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                    {displayedContact.phone || "Not supplied"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="admin-eyebrow">Business</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--admin-ink)]">
                    <Building2 className="size-4 text-[var(--admin-muted)]" />
                    {displayedContact.business_name ||
                      displayedContact.business_type ||
                      "Not supplied"}
                  </dd>
                </div>
              </dl>
              <div>
                <button
                  type="button"
                  className="text-left font-semibold hover:underline"
                  onClick={() => open(contact)}
                >
                  {contact.full_name}
                </button>
                <p className="admin-copy text-sm">
                  {contact.primary_email || contact.phone || "No email or phone"}
                  {contact.title ? ` · ${contact.title}` : ""}
                </p>
                <p className="admin-copy text-xs">
                  {contact.lifecycle_stage.replaceAll("_", " ")}
                  {contact.next_action ? ` · Next: ${contact.next_action}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="admin-button admin-button--secondary"
                  type="button"
                  onClick={() => open(contact)}
                >
                  Edit
                </button>
                <Link
                  className="admin-button admin-button--secondary"
                  href={`/admin/contacts/${contact.id}`}
                >
                  History
                </Link>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            className="admin-button admin-button--secondary"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="admin-copy text-sm">Page {page}</span>
          <button
            className="admin-button admin-button--secondary"
            type="button"
            disabled={page * 50 >= (directory.data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Next page
          </button>
        </div>
      </AdminSurface>
      {editing && (
        <AdminSurface padding="lg">
          <h2 className="text-lg font-semibold">
            {editing === "new" ? "Add contact" : `Edit ${selected?.full_name ?? "contact"}`}
          </h2>
          <form onSubmit={save} className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2">
            {(
              [
                ["fullName", "Full name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["title", "Role or title"],
                ["nextAction", "Next action"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm font-medium">
                {label}
                <input
                  className="admin-field mt-2 w-full"
                  type={key === "email" ? "email" : "text"}
                  required={key === "fullName"}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </label>
            ))}
            <label className="text-sm font-medium">
              Stage
              <select
                className="admin-field mt-2 w-full"
                value={draft.lifecycleStage}
                onChange={(event) => setDraft({ ...draft, lifecycleStage: event.target.value })}
              >
                {!(["lead", "prospect", "customer", "former_customer"] as string[]).includes(
                  draft.lifecycleStage,
                ) && (
                  <option value={draft.lifecycleStage}>
                    {draft.lifecycleStage.replaceAll("_", " ")}
                  </option>
                )}
                {["lead", "prospect", "customer", "former_customer"].map((stage) => (
                  <option key={stage} value={stage}>
                    {stage.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Next action date
              <input
                className="admin-field mt-2 w-full"
                type="datetime-local"
                value={draft.nextActionAt}
                onChange={(event) => setDraft({ ...draft, nextActionAt: event.target.value })}
              />
            </label>
            {error && (
              <p role="alert" className="sm:col-span-2 text-sm text-[var(--admin-danger)]">
                {error}
              </p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button className="admin-button admin-button--primary" disabled={busy} type="submit">
                {busy ? "Saving…" : "Save contact"}
              </button>
              <button
                className="admin-button admin-button--secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminSurface>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const params = useSearchParams();
  return params.get("view") === "requests" || params.has("submission") ? (
    <ContactSubmissionsPage />
  ) : (
    <DirectoryPage />
  );
}
