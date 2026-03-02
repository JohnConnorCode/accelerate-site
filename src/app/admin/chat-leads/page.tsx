"use client";

import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronDown, ChevronUp, MessageCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatLead {
  id: string;
  name: string;
  email: string;
  conversation: ChatMessage[];
  created_at: string;
}

export default function ChatLeadsPage() {
  const [leads, setLeads] = useState<ChatLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/chat-leads?page=${page}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!searchQuery) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(
      (l) => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Chat Leads" />
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
      <PageHeader title="Chat Leads" subtitle={`${total} total`} />

      {/* Search */}
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
      </div>

      <GlassCard padding="none" hover="none" className="overflow-clip">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-glass">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Messages</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase">Date</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, index) => (
              <Fragment key={lead.id}>
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-b border-border-glass hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  <td className="px-4 py-3 text-white-primary font-medium">{lead.name}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/contacts/${encodeURIComponent(lead.email)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-white-secondary hover:text-[var(--gold-light)] transition-colors"
                    >
                      {lead.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white-secondary">
                    {lead.conversation?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-white-muted text-xs">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {expandedId === lead.id ? (
                      <ChevronUp className="h-4 w-4 text-white-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white-muted" />
                    )}
                  </td>
                </motion.tr>
                <AnimatePresence>
                  {expandedId === lead.id && (
                    <motion.tr
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <td colSpan={5} className="px-4 py-4 bg-bg-elevated">
                        <GlassCard padding="sm" hover="none">
                          <div className="space-y-3 max-h-80 overflow-y-auto">
                            {(lead.conversation || []).map((msg, i) => (
                              <div
                                key={i}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                    msg.role === "user"
                                      ? "bg-white/10 text-white-primary"
                                      : "glass text-white-secondary"
                                  }`}
                                >
                                  <p className="text-[10px] text-white-muted mb-1 uppercase">
                                    {msg.role}
                                  </p>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                            {(!lead.conversation || lead.conversation.length === 0) && (
                              <p className="text-sm text-white-muted">No conversation recorded</p>
                            )}
                          </div>
                        </GlassCard>
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState message="No chat leads found" icon={MessageCircle} />
        )}
      </GlassCard>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </motion.div>
  );
}
