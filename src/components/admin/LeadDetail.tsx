"use client";

import { useState } from "react";
import Link from "@/components/admin/AdminLink";
import { ArrowUpRight, Mail, DollarSign, FileCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateLeadScore, getScoreColor, getScoreLabel } from "@/lib/admin/lead-scoring";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";
import { TaskQuickAdd } from "./TaskQuickAdd";
import { EmailComposeModal } from "./EmailComposeModal";

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
  estimated_value?: number;
  revenue_os?: { opportunity_id: string | null; contact_id: string | null; stage: string | null };
}

interface LeadDetailProps {
  lead: Lead;
  onUpdate: (
    id: string,
    data: { lead_status?: string; notes?: string; estimated_value?: number },
  ) => void;
}

const statusOptions = ["new", "contacted", "qualified", "proposal", "won", "lost"];

export function LeadDetail({ lead, onUpdate }: LeadDetailProps) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [status, setStatus] = useState(lead.lead_status);
  const [dealValue, setDealValue] = useState(lead.estimated_value?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [generatingProposal, setGeneratingProposal] = useState(false);

  const score = calculateLeadScore(lead);
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  const handleSave = async () => {
    setSaving(true);
    const updateData: { lead_status?: string; notes?: string; estimated_value?: number } = {
      lead_status: status,
      notes,
    };
    const parsedValue = parseFloat(dealValue);
    if (!isNaN(parsedValue) && parsedValue >= 0) {
      updateData.estimated_value = parsedValue;
    } else if (dealValue === "") {
      updateData.estimated_value = 0;
    }
    await onUpdate(lead.id, updateData);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* AI Score Badge */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            scoreColor,
          )}
        >
          Score: {score} ({scoreLabel})
        </span>
        <Button variant="secondary" size="sm" onClick={() => setShowEmailModal(true)}>
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          Send Email
        </Button>
        {lead.revenue_os?.opportunity_id && (
          <Link
            href={`/admin/pipeline?search=${encodeURIComponent(lead.contact_email)}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-glass px-3 text-xs font-medium text-white-secondary transition-[border-color,color,transform] hover:border-white/20 hover:text-white-primary active:scale-[0.97]"
          >
            Pipeline · {lead.revenue_os.stage || "linked"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {(status === "proposal" || status === "qualified") && (
          <Button
            variant="secondary"
            size="sm"
            disabled={generatingProposal}
            onClick={async () => {
              setGeneratingProposal(true);
              try {
                const genRes = await fetch("/api/admin/proposals/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ lead_id: lead.id }),
                });
                const genData = await genRes.json();
                if (!genRes.ok) throw new Error(genData.error);

                const createRes = await fetch("/api/admin/proposals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    lead_id: lead.id,
                    client_name: genData.clientName || lead.contact_name,
                    title: `Proposal for ${genData.businessName || lead.business_name || lead.contact_name}`,
                    content: genData.content,
                    total_monthly: genData.totalMonthly,
                    total_one_time: genData.totalOneTime,
                  }),
                });
                if (!createRes.ok) throw new Error("Failed to create proposal");

                setToast({ message: "Proposal generated! View in Proposals.", type: "success" });
              } catch (err) {
                setToast({
                  message: err instanceof Error ? err.message : "Failed to generate",
                  type: "error",
                });
              } finally {
                setGeneratingProposal(false);
              }
            }}
          >
            {generatingProposal ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileCheck className="h-3.5 w-3.5 mr-1.5" />
            )}
            {generatingProposal ? "Generating..." : "Create Proposal"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Status */}
        <div>
          <label className="block text-xs text-white-muted mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status"
            className="w-full rounded-lg bg-bg-subtle border border-border-glass px-3 py-2 text-sm text-white-primary focus-visible:outline-none focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-[var(--gold-base)]/30 transition-[border-color,box-shadow,background-color] duration-200"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Deal Value */}
        <div>
          <label className="block text-xs text-white-muted mb-1">Deal Value</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
            <input
              type="number"
              min="0"
              step="100"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg bg-bg-subtle border border-border-glass pl-9 pr-3 py-2 text-sm text-white-primary focus-visible:outline-none focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-[var(--gold-base)]/30 transition-[border-color,box-shadow,background-color] duration-200"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Intake summary */}
        <div>
          <label className="block text-xs text-white-muted mb-1">Intake Summary</label>
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

        {/* Contact info */}
        <div>
          <label className="block text-xs text-white-muted mb-1">Contact</label>
          <div className="text-xs text-white-secondary space-y-0.5">
            <p>{lead.contact_email}</p>
            {lead.contact_phone && <p>{lead.contact_phone}</p>}
            {lead.business_name && <p>{lead.business_name}</p>}
          </div>
        </div>
      </div>

      {/* AI Plan Preview */}
      {lead.ai_plan && (
        <div>
          <label className="block text-xs text-white-muted mb-1">AI Plan Summary</label>
          <p className="text-sm text-white-secondary">
            {(lead.ai_plan as { executiveSummary?: string }).executiveSummary || "Plan generated"}
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

      {/* Follow-up Task */}
      <TaskQuickAdd relatedType="lead" relatedId={lead.id} relatedName={lead.contact_name} />

      <EmailComposeModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipientEmail={lead.contact_email}
        recipientName={lead.contact_name}
        businessName={lead.business_name}
        leadId={lead.id}
      />

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
