"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Save, Send, Eye, Trash2, Plus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";

interface ProposalSection {
  title: string;
  content?: string;
  items?: string[];
  pricing?: { item: string; monthly: number; oneTime: number }[];
}

interface Proposal {
  id: string;
  lead_id: string | null;
  client_name: string;
  share_token: string;
  title: string;
  content: { sections: ProposalSection[] };
  total_one_time: number;
  total_monthly: number;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
}

interface ProposalEditorProps {
  proposal: Proposal;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}

export function ProposalEditor({ proposal, onSave }: ProposalEditorProps) {
  const pathname = usePathname();
  const [title, setTitle] = useState(proposal.title);
  const [sections, setSections] = useState<ProposalSection[]>(proposal.content?.sections || []);
  const [totalMonthly, setTotalMonthly] = useState(proposal.total_monthly?.toString() || "0");
  const [totalOneTime, setTotalOneTime] = useState(proposal.total_one_time?.toString() || "0");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        id: proposal.id,
        title,
        content: { sections },
        total_monthly: parseFloat(totalMonthly) || 0,
        total_one_time: parseFloat(totalOneTime) || 0,
      });
      setToast({ message: "Proposal saved", type: "success" });
    } catch {
      setToast({ message: "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSent = async () => {
    try {
      await onSave({ id: proposal.id, status: "sent" });
      setToast({ message: "Proposal marked as sent", type: "success" });
    } catch {
      setToast({ message: "Failed to update status", type: "error" });
    }
  };

  const updateSection = (idx: number, field: string, value: unknown) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSection = () => {
    setSections((prev) => [...prev, { title: "New Section", content: "" }]);
  };

  const tenantSlug = pathname.match(/^\/t\/([^/]+)\/admin(?:\/|$)/)?.[1];
  const sharePath = tenantSlug
    ? `/t/${tenantSlug}/proposal/${proposal.share_token}`
    : `/proposal/${proposal.share_token}`;
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? "Saving..." : "Save"}
        </Button>
        {proposal.status === "draft" && (
          <Button variant="secondary" size="sm" onClick={handleMarkSent}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Mark Sent
          </Button>
        )}
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-white-muted transition-colors hover:bg-white/5 hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </a>
        <div className="basis-full text-xs text-white-muted sm:ml-auto sm:basis-auto">
          Status: <span className="text-white-secondary capitalize">{proposal.status}</span>
          {proposal.viewed_at && proposal.status !== "viewed" && " · Viewed"}
        </div>
      </div>

      {/* Share link */}
      <GlassCard hover="none" padding="sm">
        <p className="text-[10px] text-white-muted uppercase font-semibold mb-1">Share Link</p>
        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-white/5 px-2 py-1 text-xs text-white-secondary">
            {shareUrl}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              setToast({ message: "Link copied!", type: "success" });
            }}
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs text-gold-light transition-colors hover:bg-white/5 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
          >
            Copy
          </button>
        </div>
      </GlassCard>

      {/* Title & Pricing */}
      <GlassCard hover="none" padding="md">
        <Input
          label="Proposal Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <Input
            label="Monthly Value ($)"
            type="number"
            value={totalMonthly}
            onChange={(e) => setTotalMonthly(e.target.value)}
          />
          <Input
            label="One-Time Value ($)"
            type="number"
            value={totalOneTime}
            onChange={(e) => setTotalOneTime(e.target.value)}
          />
        </div>
      </GlassCard>

      {/* Sections */}
      {sections.map((section, idx) => (
        <GlassCard key={idx} hover="none" padding="md">
          <div className="flex items-center justify-between mb-3">
            <Input
              type="text"
              value={section.title}
              onChange={(e) => updateSection(idx, "title", e.target.value)}
              className="font-semibold"
            />
            <button
              type="button"
              onClick={() => removeSection(idx)}
              aria-label={`Remove ${section.title} section`}
              className="ml-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-white-muted transition-colors hover:bg-white/5 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {section.content !== undefined && (
            <Textarea
              value={section.content}
              onChange={(e) => updateSection(idx, "content", e.target.value)}
              placeholder="Section content..."
              className="min-h-[80px]"
            />
          )}

          {section.items && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-white-muted uppercase font-semibold">Items</p>
              {section.items.map((item, itemIdx) => (
                <Input
                  key={itemIdx}
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...section.items!];
                    newItems[itemIdx] = e.target.value;
                    updateSection(idx, "items", newItems);
                  }}
                />
              ))}
            </div>
          )}

          {section.pricing && (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] text-white-muted uppercase font-semibold">Pricing</p>
              {section.pricing.map((price, priceIdx) => (
                <div key={priceIdx} className="grid grid-cols-3 gap-2">
                  <Input
                    type="text"
                    value={price.item}
                    onChange={(e) => {
                      const newPricing = [...section.pricing!];
                      newPricing[priceIdx] = { ...price, item: e.target.value };
                      updateSection(idx, "pricing", newPricing);
                    }}
                    placeholder="Item"
                  />
                  <Input
                    type="number"
                    value={price.monthly.toString()}
                    onChange={(e) => {
                      const newPricing = [...section.pricing!];
                      newPricing[priceIdx] = { ...price, monthly: parseFloat(e.target.value) || 0 };
                      updateSection(idx, "pricing", newPricing);
                    }}
                    placeholder="Monthly"
                  />
                  <Input
                    type="number"
                    value={price.oneTime.toString()}
                    onChange={(e) => {
                      const newPricing = [...section.pricing!];
                      newPricing[priceIdx] = { ...price, oneTime: parseFloat(e.target.value) || 0 };
                      updateSection(idx, "pricing", newPricing);
                    }}
                    placeholder="One-time"
                  />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-white-muted transition-colors hover:bg-white/5 hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
      >
        <Plus className="h-4 w-4" />
        Add Section
      </button>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
