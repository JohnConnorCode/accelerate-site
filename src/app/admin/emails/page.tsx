"use client";

import { useEffect, useState } from "react";
import { Copy, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { cn } from "@/lib/utils";

interface EmailEntry {
  id: string;
  name: string;
  category: string;
  subject: string;
  delayDays?: number;
}

interface EmailPreview {
  id: string;
  subject: string;
  html: string;
  name: string;
  category: string;
  delayDays?: number;
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/emails/preview")
      .then((r) => r.json())
      .then(async (data) => {
        const nextEmails = data.emails || [];
        setEmails(nextEmails);
        const first = nextEmails[0] as EmailEntry | undefined;
        if (!first) return;
        setSelectedId(first.id);
        setPreviewLoading(true);
        const previewResponse = await fetch(`/api/admin/emails/preview?id=${first.id}`);
        if (previewResponse.ok) setPreview(await previewResponse.json());
        setPreviewLoading(false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/emails/preview?id=${id}`);
      const data = await res.json();
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const grouped = emails.reduce<Record<string, EmailEntry[]>>((acc, email) => {
    if (!acc[email.category]) acc[email.category] = [];
    acc[email.category]!.push(email);
    return acc;
  }, {});

  if (loading) {
    return (
      <>
        <PageHeader title="Email Previews" subtitle="Preview all outbound emails" />
        <LoadingSkeleton />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Email Studio"
        subtitle={`${emails.length} live templates across transactional, operator, and automated email.`}
      />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left panel — email list */}
        <GlassCard padding="none" className="lg:w-[320px] shrink-0">
          <div className="divide-y divide-border-glass">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="px-4 py-2 text-[10px] font-semibold text-white-muted uppercase tracking-wider bg-white/[0.02]">
                  {category}
                </p>
                {items.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => handleSelect(email.id)}
                    className={cn(
                      "w-full min-h-14 text-left px-4 py-3 text-sm transition-[background-color,color,transform] active:scale-[0.99] cursor-pointer",
                      selectedId === email.id
                        ? "bg-gold-gradient text-black font-semibold"
                        : "text-white-secondary hover:bg-white/5"
                    )}
                  >
                    <p className="truncate text-pretty">{email.name}</p>
                    <p
                      className={cn(
                        "text-xs truncate mt-0.5",
                        selectedId === email.id
                          ? "text-black/60"
                          : "text-white-muted"
                      )}
                    >
                      {email.subject}
                    </p>
                    {email.delayDays != null && (
                      <p className={cn("mt-1 font-mono text-[9px] uppercase tracking-[0.12em]", selectedId === email.id ? "text-black/50" : "text-white/35")}>
                        {email.delayDays === 0 ? "Sends immediately" : `Sends after ${email.delayDays}d`}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Right panel — preview */}
        <GlassCard padding="none" className="flex-1 min-h-[600px] overflow-hidden">
          {previewLoading ? (
            <div className="p-6">
              <LoadingSkeleton />
            </div>
          ) : preview ? (
            <motion.div
              key={preview.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-glass px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="admin-eyebrow">{preview.category}{preview.delayDays != null ? ` · ${preview.delayDays === 0 ? "Immediate" : `Day ${preview.delayDays}`}` : ""}</p>
                  <p className="text-pretty text-sm font-medium text-white-primary">{preview.subject}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(preview.subject)}
                  className="admin-icon-button shrink-0"
                  aria-label="Copy subject"
                  title="Copy subject"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 sm:p-4" style={{ backgroundColor: "#0A0A0A" }}>
                <iframe
                  srcDoc={preview.html}
                  sandbox=""
                  className="w-full rounded-[10px] border-0 bg-[#0A0A0A] outline outline-1 -outline-offset-1 outline-white/10"
                  style={{ height: 600, backgroundColor: "#0A0A0A" }}
                  title={`Email preview: ${preview.subject}`}
                />
              </div>
            </motion.div>
          ) : (
            <div className="flex min-h-[400px] h-full flex-col items-center justify-center text-white-muted">
              <Mail className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Preparing the email workspace…</p>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}
