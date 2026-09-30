"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/lib/admin/useToast";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
}

const sourceOptions = [
  { value: "referral", label: "Referral" },
  { value: "call", label: "Phone Call" },
  { value: "networking", label: "Networking" },
  { value: "event", label: "Event" },
  { value: "social_media", label: "Social Media" },
  { value: "other", label: "Other" },
];

const industryOptions = [
  { value: "law_firm", label: "Law Firm" },
  { value: "real_estate", label: "Real Estate" },
  { value: "professional_services", label: "Professional Services" },
  { value: "healthcare", label: "Healthcare" },
  { value: "home_services", label: "Home Services" },
  { value: "financial_services", label: "Financial Services" },
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

export function AddLeadModal({ isOpen, onClose, onLeadCreated }: AddLeadModalProps) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("other");
  const [source, setSource] = useState("referral");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [savedPartial, setSavedPartial] = useState(false);

  const clearForm = () => {
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setBusinessName("");
    setIndustry("other");
    setSource("referral");
    setNotes("");
    requestId.current = null;
    setSaveError("");
    setSavedPartial(false);
  };
  const close = () => {
    if (inFlight.current) return;
    clearForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!contactName.trim() || !contactEmail.trim() || inFlight.current) return;
    inFlight.current = true;
    requestId.current ??= crypto.randomUUID();
    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone || null,
          business_name: businessName || null,
          industry,
          source,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) requestId.current = null;
        throw new Error(
          data.error || "Could not confirm the lead save. Retry with the same details.",
        );
      }
      if (data.lead) onLeadCreated();
      if (data.status !== "complete" || data.canonicalLinked !== true) {
        setSavedPartial(Boolean(data.lead));
        setSaveError(
          data.error ||
            "Lead saved. Pipeline setup is incomplete. Retry setup to finish saving this lead.",
        );
        return;
      }
      toast.success("Lead created and linked to Pipeline");
      clearForm();
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Could not confirm the save. Retry with the same details.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <AdminDialog
        open={isOpen}
        onClose={close}
        title="Add new lead"
        labelledBy="add-lead-title"
        maxWidth="md"
      >
        <AdminSurface padding="lg" className="admin-dialog-surface max-h-[92dvh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 id="add-lead-title" className="admin-dialog-title">
              Add New Lead
            </h3>
            <button
              type="button"
              onClick={close}
              aria-label="Close dialog"
              className="admin-icon-button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {saveError && (
            <AdminSurface tone="attention" padding="sm" role="alert" className="mb-4 text-sm">
              <p className="font-medium">
                {savedPartial ? "Lead saved; setup needs attention" : "Save needs attention"}
              </p>
              <p className="mt-1 text-white-secondary">{saveError}</p>
            </AdminSurface>
          )}
          <div className="space-y-3">
            <fieldset disabled={saving || requestId.current !== null} className="space-y-3">
              <Input
                label="Contact Name *"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Smith"
              />
              <Input
                label="Email *"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="john@company.com"
              />
              <Input
                label="Phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
              <Input
                label="Business Name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Smith & Associates"
              />

              <div>
                <label className="admin-field-label mb-1">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  aria-label="Industry"
                  className="admin-field"
                >
                  {industryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="admin-field-label mb-1">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Source"
                  className="admin-field"
                >
                  {sourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <Textarea
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did you meet? Any context..."
                className="min-h-[60px]"
              />
            </fieldset>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={saving || !contactName || !contactEmail}
              className="w-full"
            >
              {saving
                ? "Saving..."
                : savedPartial
                  ? "Retry setup"
                  : saveError
                    ? "Retry save"
                    : "Create Lead"}
            </Button>
          </div>
        </AdminSurface>
      </AdminDialog>
    </>
  );
}
