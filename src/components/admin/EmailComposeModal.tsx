"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
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
    label: "Introduction",
    subject: "Welcome to Accelerate — Your Custom Growth Plan",
    body: `Hi {{name}},

Thank you for requesting a custom growth plan for {{business}}. I've reviewed your submission and wanted to personally reach out.

Your plan highlights several key opportunities specific to your industry. I'd love to walk you through the findings and discuss how we can help implement them.

Would you be open to a quick 15-minute call this week?

Best,
Accelerate Team`,
  },
  {
    label: "Follow-up",
    subject: "Following up on your growth plan",
    body: `Hi {{name}},

I wanted to follow up on the growth plan we prepared for {{business}}. Have you had a chance to review it?

I noticed some quick wins that could start generating results within the first 30 days. Happy to walk you through the specifics.

Let me know if you have any questions.

Best,
Accelerate Team`,
  },
  {
    label: "Proposal",
    subject: "Your Custom Proposal from Accelerate",
    body: `Hi {{name}},

Following our conversation, I've put together a proposal tailored to {{business}}'s needs.

The plan covers:
- [Key deliverable 1]
- [Key deliverable 2]
- [Key deliverable 3]

I believe this approach will deliver measurable results within 60-90 days. Happy to discuss the details at your convenience.

Best,
Accelerate Team`,
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
}

export function EmailComposeModal({
  isOpen,
  onClose,
  recipientEmail,
  recipientName,
  businessName,
  leadId,
}: EmailComposeModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("Custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
    if (!subject || !body) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          body,
          leadId,
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
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={onClose}
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
                    onClick={onClose}
                    className="text-white-muted hover:text-white-primary cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <Input label="To" type="text" value={recipientEmail} disabled />

                  {/* Template selector */}
                  <div>
                    <label className="block text-xs text-white-muted mb-1">Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="w-full rounded-lg bg-bg-subtle border border-border-glass px-3 py-2 text-sm text-white-primary focus:outline-none focus:border-gold transition-all"
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
                    disabled={sending || !subject || !body}
                    className="w-full"
                  >
                    {sending ? "Sending..." : "Send Email"}
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
    </>
  );
}
