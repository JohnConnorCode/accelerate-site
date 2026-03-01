"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { contactMethodOptions } from "@/content/intake-questions";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { IntakeFormData } from "@/lib/types";

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ContactStep({ formData, onUpdate, onSubmit }: StepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const consent = formData.consentGiven ?? false;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.contactName?.trim()) {
      newErrors.contactName = "Your name is required";
    }
    if (!formData.contactEmail?.trim()) {
      newErrors.contactEmail = "Email address is required";
    } else if (!isValidEmail(formData.contactEmail)) {
      newErrors.contactEmail = "Please enter a valid email address";
    }
    if (!consent) {
      newErrors.consent = "You must agree to be contacted";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
          Where should we send your plan?
        </h2>
        <p className="text-white-secondary">
          We will generate a custom growth plan and send it to you.
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-lg mx-auto"
      >
        <motion.div variants={fadeUp}>
          <Input
            id="contact-name"
            label="Your name *"
            placeholder="John Smith"
            value={formData.contactName || ""}
            error={errors.contactName}
            onChange={(e) => {
              onUpdate({ contactName: e.target.value });
              if (errors.contactName) {
                setErrors((prev) => ({ ...prev, contactName: "" }));
              }
            }}
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Input
            id="contact-email"
            label="Email address *"
            type="email"
            placeholder="john@yourbusiness.com"
            value={formData.contactEmail || ""}
            error={errors.contactEmail}
            onChange={(e) => {
              onUpdate({ contactEmail: e.target.value });
              if (errors.contactEmail) {
                setErrors((prev) => ({ ...prev, contactEmail: "" }));
              }
            }}
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Input
            id="contact-phone"
            label="Phone number (optional)"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.contactPhone || ""}
            onChange={(e) => onUpdate({ contactPhone: e.target.value })}
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Select
            id="contact-method"
            label="Preferred contact method"
            options={contactMethodOptions}
            placeholder="Select..."
            value={formData.contactMethod || ""}
            onChange={(e) =>
              onUpdate({
                contactMethod: e.target.value as IntakeFormData["contactMethod"],
              })
            }
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <label
            className={cn(
              "flex items-start gap-3 cursor-pointer select-none min-h-[44px]",
              errors.consent ? "text-[var(--error)]" : ""
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                consent
                  ? "bg-gold-gradient border-transparent"
                  : errors.consent
                    ? "border-[var(--error)]"
                    : "border-[var(--border-glass)]"
              )}
            >
              {consent && (
                <svg
                  className="w-3.5 h-3.5 text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span className="text-sm text-white-secondary">
              I agree to be contacted about my growth plan.
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={consent}
              onChange={(e) => {
                onUpdate({ consentGiven: e.target.checked });
                if (errors.consent) {
                  setErrors((prev) => ({ ...prev, consent: "" }));
                }
              }}
            />
          </label>
          {errors.consent && (
            <p className="mt-1.5 text-sm text-[var(--error)]">
              {errors.consent}
            </p>
          )}
        </motion.div>

        <motion.div variants={fadeUp}>
          <Button
            onClick={handleSubmit}
            className="w-full"
            size="lg"
            pulse
          >
            Generate My Growth Plan
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
