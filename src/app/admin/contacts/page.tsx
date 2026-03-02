"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Inbox, Trash2, ChevronDown, ChevronUp, Search, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  business_type?: string;
  message: string;
  created_at: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/contacts?page=${page}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setToast({ message: "Failed to load contacts", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
      }
      if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        if (new Date(c.created_at) >= end) return false;
      }
      return true;
    });
  }, [contacts, searchQuery, dateFrom, dateTo]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Contact deleted", type: "success" });
      await fetchData();
    } catch {
      setToast({ message: "Failed to delete contact", type: "error" });
    }
  };

  const handleExport = () => {
    window.open("/api/admin/contacts/export", "_blank");
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Contact Submissions" />
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
        title="Contact Submissions"
        subtitle={`${total} total submissions`}
      />

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase hidden sm:table-cell">Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Message</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Date</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((contact, index) => (
              <motion.tr
                key={contact.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border-glass hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
              >
                <td className="px-4 py-3 text-white-primary font-medium">{contact.name}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/contacts/${encodeURIComponent(contact.email)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-white-secondary hover:text-[var(--gold-light)] transition-colors"
                  >
                    {contact.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-white-secondary hidden sm:table-cell">{contact.business_type || "-"}</td>
                <td className="px-4 py-3 text-white-muted truncate max-w-[200px]">
                  {contact.message}
                </td>
                <td className="px-4 py-3 text-white-muted text-xs">
                  {new Date(contact.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }}
                      className="text-white-muted hover:text-[var(--error)] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {expandedId === contact.id ? (
                      <ChevronUp className="h-4 w-4 text-white-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white-muted" />
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <AnimatePresence>
          {contacts.map((contact) =>
            expandedId === contact.id ? (
              <motion.div
                key={`expanded-${contact.id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-border-glass bg-bg-elevated px-6 py-4"
              >
                <p className="text-xs text-white-muted uppercase mb-2">Full Message</p>
                <p className="text-sm text-white-secondary whitespace-pre-wrap">{contact.message}</p>
                {contact.phone && (
                  <p className="mt-2 text-xs text-white-muted">Phone: {contact.phone}</p>
                )}
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
        {filtered.length === 0 && (
          <EmptyState message="No contact submissions found" icon={Inbox} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {toast && (
        <Toast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} />
      )}
    </motion.div>
  );
}
