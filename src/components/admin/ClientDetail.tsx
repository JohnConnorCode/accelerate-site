"use client";

import { useState } from "react";
import { DollarSign, Calendar, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";
import { AdminSurface } from "./AdminSurface";
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
        <span className="text-xs text-[var(--admin-muted)]">
          Client since {new Date(client.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Status + Values */}
      <AdminSurface padding="md">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--admin-muted)]">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="min-h-11 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--admin-muted)]">Industry</label>
            <p className="text-sm capitalize text-[var(--admin-ink)]">
              {client.industry?.replace(/_/g, " ") || "N/A"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--admin-muted)]">Monthly Value (MRR)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
              <input
                type="number"
                min="0"
                step="100"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
                className="min-h-11 w-full rounded-xl bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--admin-muted)]">One-Time Value</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
              <input
                type="number"
                min="0"
                step="100"
                value={oneTimeValue}
                onChange={(e) => setOneTimeValue(e.target.value)}
                className="min-h-11 w-full rounded-xl bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-[var(--admin-muted)]">
              <Calendar className="h-3 w-3" /> Contract Start
            </label>
            <input
              type="date"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
              className="min-h-11 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-[var(--admin-muted)]">
              <Calendar className="h-3 w-3" /> Contract End
            </label>
            <input
              type="date"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
              className="min-h-11 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ink)]/25"
            />
          </div>
        </div>
      </AdminSurface>

      {/* Contact Info */}
      <AdminSurface padding="md">
        <h4 className="admin-eyebrow mb-3">Contact information</h4>
        <div className="space-y-1 text-sm text-[var(--admin-ink)]">
          <p><span className="text-[var(--admin-muted)]">Name:</span> {client.contact_name}</p>
          <p><span className="text-[var(--admin-muted)]">Email:</span> {client.contact_email}</p>
          {client.contact_phone && <p><span className="text-[var(--admin-muted)]">Phone:</span> {client.contact_phone}</p>}
        </div>
      </AdminSurface>

      {/* Services */}
      {client.services && client.services.length > 0 && (
        <AdminSurface padding="md">
          <h4 className="admin-eyebrow mb-3">Services</h4>
          <div className="flex flex-wrap gap-2">
            {client.services.map((service, i) => (
              <span
                key={i}
                className="rounded-full bg-[var(--admin-surface-subtle)] px-3 py-1 text-xs text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]"
              >
                {service}
              </span>
            ))}
          </div>
        </AdminSurface>
      )}

      {/* Onboarding Checklist */}
      {status === "onboarding" && (
        <AdminSurface padding="md">
          <h4 className="admin-eyebrow mb-3">Onboarding checklist</h4>
          <div className="space-y-2">
            {checklist.map((item, idx) => (
              <button
                key={idx}
                onClick={() => toggleChecklistItem(idx)}
                className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-[var(--admin-surface-subtle)] active:scale-[0.96]"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" />
                )}
                <span className={`text-sm ${item.done ? "text-[var(--admin-muted)] line-through" : "text-[var(--admin-ink)]"}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </AdminSurface>
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
