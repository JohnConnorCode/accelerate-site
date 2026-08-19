"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";

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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async () => {
    if (!contactName || !contactEmail) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone || null,
          business_name: businessName || null,
          industry,
          source,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create lead");
      }

      setToast({ message: "Lead created successfully", type: "success" });
      // Reset form
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setBusinessName("");
      setIndustry("other");
      setSource("referral");
      setNotes("");
      onLeadCreated();
      setTimeout(onClose, 500);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to create lead", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminDialog open={isOpen} onClose={onClose} title="Add new lead" labelledBy="add-lead-title" maxWidth="md">
              <AdminSurface padding="lg" className="admin-dialog-surface max-h-[92dvh] overflow-y-auto rounded-[20px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 id="add-lead-title" className="admin-dialog-title">
                    Add New Lead
                  </h3>
                  <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="admin-icon-button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
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
                      className="admin-field"
                    >
                      {industryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="admin-field-label mb-1">Source</label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="admin-field"
                    >
                      {sourceOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
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

                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={saving || !contactName || !contactEmail}
                    className="w-full"
                  >
                    {saving ? "Creating..." : "Create Lead"}
                  </Button>
                </div>
              </AdminSurface>
      </AdminDialog>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
