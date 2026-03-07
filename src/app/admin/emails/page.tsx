"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
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
}

interface EmailPreview {
  id: string;
  subject: string;
  html: string;
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
      .then((data) => setEmails(data.emails || []))
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
        title="Email Previews"
        subtitle={`${emails.length} outbound email templates`}
      />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left panel — email list */}
        <GlassCard padding="none" className="lg:w-[300px] shrink-0">
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
                      "w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer",
                      selectedId === email.id
                        ? "bg-gold-gradient text-black font-semibold"
                        : "text-white-secondary hover:bg-white/5"
                    )}
                  >
                    <p className="truncate">{email.name}</p>
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
                  </button>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Right panel — preview */}
        <GlassCard padding="none" className="flex-1 min-h-[600px]">
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
              <div className="px-6 py-4 border-b border-border-glass">
                <p className="text-xs text-white-muted">Subject</p>
                <p className="text-sm text-white-primary font-medium mt-0.5">
                  {preview.subject}
                </p>
              </div>
              <div className="p-4" style={{ backgroundColor: "#0A0A0A" }}>
                <iframe
                  srcDoc={preview.html}
                  sandbox=""
                  className="w-full border-0 rounded-lg"
                  style={{ height: 600, backgroundColor: "#0A0A0A" }}
                  title={`Email preview: ${preview.subject}`}
                />
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-white-muted">
              <Mail className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Select an email to preview</p>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}
