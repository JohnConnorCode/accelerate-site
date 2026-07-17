"use client";

import { useState } from "react";
import { DollarSign, Calendar, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "./StatusBadge";
import { TaskQuickAdd } from "./TaskQuickAdd";

interface Client {
  id: string;
  lead_id: string | null;
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  industry: string | null;
  status: string;
  monthly_value: number;
  one_time_value: number;
  contract_start: string | null;
  contract_end: string | null;
  services: string[];
  onboarding_checklist: { label: string; done: boolean }[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientDetailProps {
  client: Client;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
}

const statusOptions = ["onboarding", "active", "paused", "churned"];

export function ClientDetail({ client, onUpdate }: ClientDetailProps) {
  const [status, setStatus] = useState(client.status);
  const [monthlyValue, setMonthlyValue] = useState(client.monthly_value?.toString() || "0");
  const [oneTimeValue, setOneTimeValue] = useState(client.one_time_value?.toString() || "0");
  const [contractStart, setContractStart] = useState(client.contract_start || "");
  const [contractEnd, setContractEnd] = useState(client.contract_end || "");
  const [notes, setNotes] = useState(client.notes || "");
  const [checklist, setChecklist] = useState<{ label: string; done: boolean }[]>(
    client.onboarding_checklist?.length > 0
      ? client.onboarding_checklist
      : [
          { label: "Kickoff call completed", done: false },
          { label: "Access credentials shared", done: false },
          { label: "Systems integrated", done: false },
          { label: "First deliverable sent", done: false },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        id: client.id,
        status,
        monthly_value: parseFloat(monthlyValue) || 0,
        one_time_value: parseFloat(oneTimeValue) || 0,
        contract_start: contractStart || null,
        contract_end: contractEnd || null,
        notes,
        onboarding_checklist: checklist,
      });
      setToast({ message: "Client updated", type: "success" });
    } catch {
      setToast({ message: "Failed to update client", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleChecklistItem = (idx: number) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, done: !item.done } : item))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={status} />
        <span className="text-white-muted text-xs">
          Client since {new Date(client.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Status + Values */}
      <GlassCard hover="none" padding="md">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-white-muted mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg bg-bg-subtle border border-border-glass px-3 py-2 text-sm text-white-primary focus:outline-none focus:border-gold focus:ring-1 focus:ring-[var(--gold-base)]/30 transition-all duration-200"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white-muted mb-1">Industry</label>
            <p className="text-sm text-white-secondary capitalize">
              {client.industry?.replace(/_/g, " ") || "N/A"}
            </p>
          </div>

          <div>
            <label className="block text-xs text-white-muted mb-1">Monthly Value (MRR)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
              <input
                type="number"
                min="0"
                step="100"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
                className="w-full rounded-lg bg-bg-subtle border border-border-glass pl-9 pr-3 py-2 text-sm text-white-primary focus:outline-none focus:border-gold focus:ring-1 focus:ring-[var(--gold-base)]/30 transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white-muted mb-1">One-Time Value</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
              <input
                type="number"
                min="0"
                step="100"
                value={oneTimeValue}
                onChange={(e) => setOneTimeValue(e.target.value)}
                className="w-full rounded-lg bg-bg-subtle border border-border-glass pl-9 pr-3 py-2 text-sm text-white-primary focus:outline-none focus:border-gold focus:ring-1 focus:ring-[var(--gold-base)]/30 transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white-muted mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Contract Start
            </label>
            <input
              type="date"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
              className="w-full rounded-lg bg-bg-subtle border border-border-glass px-3 py-2 text-sm text-white-primary focus:outline-none focus:border-gold transition-all"
            />
          </div>

          <div>
            <label className="block text-xs text-white-muted mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Contract End
            </label>
            <input
              type="date"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
              className="w-full rounded-lg bg-bg-subtle border border-border-glass px-3 py-2 text-sm text-white-primary focus:outline-none focus:border-gold transition-all"
            />
          </div>
        </div>
      </GlassCard>

      {/* Contact Info */}
      <GlassCard hover="none" padding="md">
        <h4 className="text-xs text-white-muted uppercase font-semibold mb-3">Contact Information</h4>
        <div className="text-sm text-white-secondary space-y-1">
          <p><span className="text-white-muted">Name:</span> {client.contact_name}</p>
          <p><span className="text-white-muted">Email:</span> {client.contact_email}</p>
          {client.contact_phone && <p><span className="text-white-muted">Phone:</span> {client.contact_phone}</p>}
        </div>
      </GlassCard>

      {/* Services */}
      {client.services && client.services.length > 0 && (
        <GlassCard hover="none" padding="md">
          <h4 className="text-xs text-white-muted uppercase font-semibold mb-3">Services</h4>
          <div className="flex flex-wrap gap-2">
            {client.services.map((service, i) => (
              <span
                key={i}
                className="text-xs bg-white/10 text-white-secondary rounded-full px-3 py-1"
              >
                {service}
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Onboarding Checklist */}
      {status === "onboarding" && (
        <GlassCard hover="none" padding="md">
          <h4 className="text-xs text-white-muted uppercase font-semibold mb-3">Onboarding Checklist</h4>
          <div className="space-y-2">
            {checklist.map((item, idx) => (
              <button
                key={idx}
                onClick={() => toggleChecklistItem(idx)}
                className="flex items-center gap-3 w-full text-left px-2 py-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-white-muted shrink-0" />
                )}
                <span className={`text-sm ${item.done ? "text-white-muted line-through" : "text-white-primary"}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Notes */}
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes about this client..."
        className="min-h-[80px]"
      />

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Follow-up Task */}
      <TaskQuickAdd
        relatedType="client"
        relatedId={client.id}
        relatedName={client.contact_name}
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
