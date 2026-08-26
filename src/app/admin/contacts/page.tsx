"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronDown, Download, Inbox, Loader2, Mail, Phone, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { ContactIntakeNav } from "@/components/admin/ContactIntakeNav";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { Toast } from "@/components/ui/Toast";
import { adminListItemVariants, adminListVariants } from "@/lib/admin/motion";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  business_type?: string;
  business_name?: string;
  message: string;
  created_at: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/contacts?page=${page}`);
      if (!response.ok) throw new Error("Failed to load submissions");
      const data = await response.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setToast({ message: "Contact submissions could not be loaded", type: "error" });
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    const requestedContact = new URLSearchParams(window.location.search).get("contact")?.trim();
    if (requestedContact) setExpandedId(requestedContact);
  }, []);

  const filtered = useMemo(() => contacts.filter((contact) => {
    const query = searchQuery.trim().toLowerCase();
    if (query && !`${contact.name} ${contact.email} ${contact.business_name || ""} ${contact.business_type || ""}`.toLowerCase().includes(query)) return false;
    if (dateFrom && new Date(contact.created_at) < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && new Date(contact.created_at) >= new Date(`${dateTo}T23:59:59.999`)) return false;
    return true;
  }), [contacts, dateFrom, dateTo, searchQuery]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch("/api/admin/contacts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("Delete failed");
      setContacts((current) => current.filter((contact) => contact.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      setExpandedId(null);
      setToast({ message: "Submission deleted", type: "success" });
    } catch {
      setToast({ message: "Submission could not be deleted", type: "error" });
    } finally { setDeletingId(null); }
  }

  return (
    <div>
      <PageHeader title="Contact intake" subtitle="Review website inquiries and bring external contact lists into the same controlled intake workflow." actions={<button type="button" onClick={() => window.open("/api/admin/contacts/export", "_blank")} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><Download className="size-3.5" /> Export</button>} />
      <ContactIntakeNav active="submissions" />

      <AdminSurface padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="admin-eyebrow">Website submissions</p><h2 className="mt-1 text-balance font-display text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Incoming contact requests</h2><p className="admin-copy mt-1 text-xs"><span className="tabular-nums">{total}</span> captured through the website form</p></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto] lg:w-[680px]">
            <label className="relative"><span className="sr-only">Search submissions</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, email, or company" className="admin-field pl-10" /></label>
            <label><span className="sr-only">From date</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="admin-field min-w-[148px] [color-scheme:light] dark:[color-scheme:dark]" /></label>
            <label><span className="sr-only">To date</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="admin-field min-w-[148px] [color-scheme:light] dark:[color-scheme:dark]" /></label>
          </div>
        </div>

        {loading ? <LoadingSkeleton variant="table" /> : filtered.length === 0 ? <div className="border-t border-[var(--admin-border)]"><EmptyState title={contacts.length ? "No submissions match these filters" : "No website submissions yet"} description={contacts.length ? "Clear the search or date range to return to the full intake." : "New website contact requests will appear here. You can still add an external list through the reviewed import flow."} icon={Inbox} actionLabel={contacts.length ? "Clear filters" : "Import a contact list"} actionHref={contacts.length ? undefined : "/admin/contact-imports"} onAction={contacts.length ? () => { setSearchQuery(""); setDateFrom(""); setDateTo(""); } : undefined} /></div> : (
          <motion.div variants={adminListVariants} initial="hidden" animate="visible" className="divide-y divide-[var(--admin-border)] border-t border-[var(--admin-border)]">
            {filtered.map((contact) => {
              const expanded = expandedId === contact.id;
              return <motion.article key={contact.id} variants={adminListItemVariants}>
                <button type="button" onClick={() => setExpandedId(expanded ? null : contact.id)} className="group grid min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-[background-color,transform] duration-150 hover:bg-black/[0.022] active:scale-[0.995] dark:hover:bg-white/[0.025] sm:px-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)_minmax(0,1.2fr)_auto]" aria-expanded={expanded} data-contact-row-toggle={contact.id}>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--admin-ink)]">{contact.name}</span><span className="admin-copy mt-0.5 block truncate text-xs">{contact.email}</span></span>
                  <span className="admin-copy hidden truncate text-xs md:block">{contact.business_name || contact.business_type || "No company supplied"}</span>
                  <span className="admin-copy hidden truncate text-xs md:block">{contact.message || "No message supplied"}</span>
                  <span className="flex items-center justify-between gap-3 md:justify-end"><span className="font-mono text-[9px] font-medium uppercase tracking-[0.07em] text-[var(--admin-muted)]">{formatDate(contact.created_at)}</span><ChevronDown className={cn("size-4 text-[var(--admin-muted)] transition-transform duration-200", expanded && "rotate-180")} /></span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="grid gap-4 bg-[var(--admin-surface-subtle)] px-4 py-4 shadow-[inset_0_1px_0_var(--admin-border)] sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div className="min-w-0"><p className="admin-eyebrow">Full message</p><p className="mt-2 max-w-3xl whitespace-pre-wrap text-pretty text-sm leading-6 text-[var(--admin-ink)]">{contact.message || "No message was supplied with this submission."}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--admin-muted)]"><a href={`mailto:${contact.email}`} className="inline-flex min-h-10 items-center gap-2 hover:text-[var(--admin-ink)]"><Mail className="size-3.5" />{contact.email}</a>{contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex min-h-10 items-center gap-2 hover:text-[var(--admin-ink)]"><Phone className="size-3.5" />{contact.phone}</a>}<span className="inline-flex min-h-10 items-center gap-2"><CalendarDays className="size-3.5" />Received {formatDate(contact.created_at)}</span></div></div>
                    <div className="flex flex-wrap gap-2"><Link href={`/admin/contacts/${encodeURIComponent(contact.email)}`} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[var(--admin-ink)] px-3 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]">Open relationship <ArrowRight className="size-3.5" /></Link><button type="button" disabled={deletingId === contact.id} onClick={() => void handleDelete(contact.id)} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,box-shadow,transform] duration-150 hover:text-rose-700 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:opacity-50 dark:hover:text-rose-300">{deletingId === contact.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Delete</button></div>
                  </motion.div>}
                </AnimatePresence>
              </motion.article>;
            })}
          </motion.div>
        )}
      </AdminSurface>

      {totalPages > 1 && <div className="mt-4 flex items-center justify-between"><p className="admin-copy text-xs">Page <span className="tabular-nums">{page}</span> of <span className="tabular-nums">{totalPages}</span></p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-10 rounded-[10px] px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-[10px] px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] disabled:opacity-40">Next</button></div></div>}
      {toast && <Toast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} />}
    </div>
  );
}
