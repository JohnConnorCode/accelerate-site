"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface ContactPanelProps {
  onSubmit: (data: {
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
    contactMethod: string;
    consentGiven: boolean;
  }) => void;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactPanel({ onSubmit }: ContactPanelProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!emailRegex.test(email)) errs.email = "Enter a valid email";
    if (!consent) errs.consent = "Please agree to continue";
    return errs;
  };

  const handleSubmit = () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({
      contactName: name.trim(),
      contactEmail: email.trim(),
      contactMethod: "email",
      consentGiven: consent,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard variant="prominent" padding="lg" className="space-y-5">
        <Input
          label="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="John Smith"
          required
        />
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="john@yourbusiness.com"
          required
        />

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded border border-border-glass peer-checked:bg-gold-gradient peer-checked:border-gold transition-all flex items-center justify-center">
              {consent && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-white-secondary leading-relaxed">
            I agree to receive my custom growth plan and occasional follow-up from Accelerate. No spam, ever.
          </span>
        </label>
        {errors.consent && (
          <p className="text-xs text-[var(--error)]">{errors.consent}</p>
        )}

        <Button
          variant="primary"
          size="lg"
          pulse
          className="w-full"
          onClick={handleSubmit}
        >
          Generate My Growth Plan
        </Button>
      </GlassCard>
    </motion.div>
  );
}
