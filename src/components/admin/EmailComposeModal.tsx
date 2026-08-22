"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";

interface EmailTemplate {
  label: string;
  subject: string;
  body: string;
}

const templates: EmailTemplate[] = [
  {
    label: "Plan review",
    subject: "A clear next step for {{business}}",
    body: `Hi {{name}},

I reviewed the plan for {{business}} and pulled out the one or two changes most likely to move the needle first.

If it would be useful, I can walk you through the reasoning, the rollout order, and what we would leave with you after the call.

Would a short conversation this week be useful?

John
Accelerate`,
  },
  {
    label: "Decision follow-up",
    subject: "A quick follow-up on {{business}}'s plan",
    body: `Hi {{name}},

I wanted to make sure the plan for {{business}} did not get buried.

The fastest wins are usually response time, follow-through, and the handoffs that depend on someone remembering. If one of those is a priority right now, I can show you the cleanest place to begin.

No pressure either way. Just reply if you want to talk it through.

John`,
  },
  {
    label: "Proposal ready",
    subject: "The proposal for {{business}} is ready",
    body: `Hi {{name}},

I put together the proposal for {{business}} around the priorities we discussed.

It covers the operating system, the implementation sequence, and what we will own after launch, so the work does not fall back on your team.

Reply with any questions, or send a few times that work and we will walk through it together.

John
Accelerate`,
  },
  { label: "Custom", subject: "", body: "" },
];

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientEmail: string;
  recipientName?: string;
  businessName?: string;
  leadId?: string;
  initialSubject?: string;
  initialBody?: string;
}

export function EmailComposeModal({
  isOpen,
  onClose,
  recipientEmail,
  recipientName,
  businessName,
  leadId,
  initialSubject = "",
  initialBody = "",
}: EmailComposeModalProps) {
  const [recipient, setRecipient] = useState(recipientEmail);
  const [selectedTemplate, setSelectedTemplate] = useState("Custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRecipient(recipientEmail);
    setSubject(initialSubject);
    setBody(initialBody);
    setSelectedTemplate(initialSubject || initialBody ? "Custom" : "Custom");
  }, [initialBody, initialSubject, isOpen, recipientEmail]);

  const applyTemplate = (templateLabel: string) => {
    setSelectedTemplate(templateLabel);
    const template = templates.find((t) => t.label === templateLabel);
    if (!template || templateLabel === "Custom") return;

    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{\{name\}\}/g, recipientName || "there")
        .replace(/\{\{business\}\}/g, businessName || "your business");

    setSubject(replacePlaceholders(template.subject));
    setBody(replacePlaceholders(template.body));
  };

  const handleSend = async () => {
    if (!recipient.trim() || !subject || !body) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient.trim(),
          subject,
          body,
          leadId,
          recipientName,
          template: selectedTemplate === "Custom" ? undefined : selectedTemplate,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ message: "Email sent successfully", type: "success" });
      setTimeout(() => {
        onClose();
        setSubject("");
        setBody("");
        setSelectedTemplate("Custom");
      }, 1000);
    } catch {
      setToast({ message: "Failed to send email", type: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AdminDialog open={isOpen} onClose={onClose} title="Compose email" labelledBy="email-compose-title" maxWidth="md">
              <AdminSurface padding="lg" className="admin-dialog-surface max-h-[92dvh] overflow-y-auto rounded-[20px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="admin-eyebrow">Direct follow-up</p>
                    <h3 id="email-compose-title" className="admin-dialog-title">
                    Compose email
                  </h3>
                  </div>
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
                    label="To"
                    type="email"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    disabled={Boolean(recipientEmail)}
                    placeholder="name@company.com"
                    autoFocus={!recipientEmail}
                  />

                  {/* Template selector */}
                  <div>
                    <label className="admin-field-label mb-1">Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="admin-field"
                    >
                      {templates.map((t) => (
                        <option key={t.label} value={t.label}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject..."
                  />
                  <Textarea
                    label="Body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your email..."
                    className="min-h-[200px]"
                  />
                  <Button
                    variant="primary"
                    onClick={handleSend}
                    disabled={sending || !recipient.trim() || !subject || !body}
                    className="w-full"
                  >
                    {sending ? "Sending..." : "Send Email"}
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
