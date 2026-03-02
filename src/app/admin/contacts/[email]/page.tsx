"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, User } from "lucide-react";
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

export default function ContactTimelinePage() {
  const params = useParams();
  const email = decodeURIComponent(params.email as string);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/contacts/timeline?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setTimeline(data.timeline || []);
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
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
            <User className="h-5 w-5 text-white-muted" />
          </div>
          <div>
            <p className="text-sm font-medium text-white-primary">{email}</p>
            <p className="text-xs text-white-muted">
              {timeline.length} interaction{timeline.length !== 1 ? "s" : ""} found
            </p>
          </div>
        </div>
      </GlassCard>

      <ContactTimeline items={timeline} />
    </motion.div>
  );
}
