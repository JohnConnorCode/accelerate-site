"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Building2, CircleAlert, CircleCheckBig, User } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";

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
  contact: { id: string; full_name: string; lifecycle_stage: string; communication_status: string; next_action: string | null; next_action_at: string | null } | null;
  company: { id: string; name: string; domain: string | null; industry: string | null } | null;
  opportunities: Array<{ id: string; stage: string; estimated_value: number; won_value: number }>;
}

export default function ContactTimelinePage() {
  const params = useParams();
  const email = decodeURIComponent(params.email as string);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [canonical, setCanonical] = useState<CanonicalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/contacts/timeline?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setTimeline(data.timeline || []);
      setCanonical(data.canonical || null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Contact Timeline" />
        <LoadingSkeleton variant="page" />
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
          href="/admin/contacts"
          className="inline-flex items-center gap-1.5 text-xs text-white-muted hover:text-white-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Contacts
        </Link>
      </div>

      <PageHeader title="Contact Timeline" subtitle={email} />

      <GlassCard hover="none" className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
            <User className="h-5 w-5 text-white-muted" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white-primary">{canonical?.contact?.full_name || email}</p>
            {canonical?.contact && <p className="truncate text-xs text-white-muted">{email}</p>}
            <p className="text-xs text-white-muted">
              {timeline.length} interaction{timeline.length !== 1 ? "s" : ""} found
            </p>
          </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {canonical?.status === "connected" ? (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300">
                <CircleCheckBig className="h-3.5 w-3.5" /> Revenue OS connected
              </span>
            ) : (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 text-xs font-medium text-amber-300">
                <CircleAlert className="h-3.5 w-3.5" /> {canonical?.status === "ambiguous" ? "Identity review needed" : canonical?.status === "degraded" ? "Revenue OS unavailable" : "Not linked yet"}
              </span>
            )}
            {canonical?.company && (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border-glass px-3 text-xs text-white-secondary">
                <Building2 className="h-3.5 w-3.5" /> {canonical.company.name}
              </span>
            )}
            {canonical?.opportunities?.length ? (
              <Link
                href={`/admin/pipeline?search=${encodeURIComponent(email)}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-white px-3 text-xs font-semibold text-black transition-[opacity,transform] hover:opacity-85 active:scale-[0.97]"
              >
                Open in Pipeline <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </GlassCard>

      <ContactTimeline items={timeline} />
    </motion.div>
  );
}
