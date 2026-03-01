"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateLeadScore, getScoreColor, getScoreLabel } from "@/lib/admin/lead-scoring";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";

interface Lead {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  business_name?: string;
  industry: string;
  lead_status: string;
  intake_data?: Record<string, unknown>;
  ai_plan?: Record<string, unknown>;
  notes?: string;
  view_count?: number;
}

interface LeadDetailProps {
  lead: Lead;
  onUpdate: (id: string, data: { lead_status?: string; notes?: string }) => void;
}

const statusOptions = ["new", "contacted", "qualified", "proposal", "won", "lost"];

export function LeadDetail({ lead, onUpdate }: LeadDetailProps) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [status, setStatus] = useState(lead.lead_status);
  const [saving, setSaving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const score = calculateLeadScore(lead);
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(lead.id, { lead_status: status, notes });
    setSaving(false);
  };

  const handleSendEmail = async () => {
    if (!emailSubject || !emailBody) return;
    setSendingEmail(true);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.contact_email,
          subject: emailSubject,
          body: emailBody,
          leadId: lead.id,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Email sent successfully", type: "success" });
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
    } catch {
      setToast({ message: "Failed to send email", type: "error" });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Score Badge */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            scoreColor
          )}
        >
          Score: {score} ({scoreLabel})
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowEmailModal(true)}
        >
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          Send Email
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Status */}
        <div>
          <label className="block text-xs text-white-muted mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-glass)] px-3 py-2 text-sm text-white-primary focus:outline-none focus:border-[var(--gold-base)] focus:ring-1 focus:ring-[var(--gold-base)]/30 transition-all duration-200"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Intake summary */}
        <div>
          <label className="block text-xs text-white-muted mb-1">
            Intake Summary
          </label>
          <div className="text-sm text-white-secondary">
            {lead.intake_data ? (
              <ul className="space-y-0.5">
                {Object.entries(lead.intake_data)
                  .filter(([key]) => !["consentGiven", "industrySpecificAnswers"].includes(key))
                  .slice(0, 6)
                  .map(([key, value]) => (
                    <li key={key} className="text-xs">
                      <span className="text-white-muted">
                        {key.replace(/([A-Z])/g, " $1").trim()}:
                      </span>{" "}
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </li>
                  ))}
              </ul>
            ) : (
              <span className="text-white-muted text-xs">No intake data</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Plan Preview */}
      {lead.ai_plan && (
        <div>
          <label className="block text-xs text-white-muted mb-1">
            AI Plan Summary
          </label>
          <p className="text-sm text-white-secondary">
            {(lead.ai_plan as { executiveSummary?: string }).executiveSummary ||
              "Plan generated"}
          </p>
        </div>
      )}

      {/* Notes */}
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this lead..."
        className="min-h-[80px]"
      />

      <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowEmailModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg mx-4"
            >
              <GlassCard variant="prominent" padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-semibold text-white-primary">
                    Send Email
                  </h3>
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="text-white-muted hover:text-white-primary cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <Input
                    label="To"
                    type="text"
                    value={lead.contact_email}
                    disabled
                  />
                  <Input
                    label="Subject"
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Email subject..."
                  />
                  <Textarea
                    label="Body"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Write your email..."
                  />
                  <Button
                    variant="primary"
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !emailSubject || !emailBody}
                    className="w-full"
                  >
                    {sendingEmail ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
