"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  businessAgeOptions,
  teamSizeOptions,
  revenueRangeOptions,
} from "@/content/intake-questions";
import { fadeUp, staggerContainer } from "@/lib/animations";
import type { IntakeFormData } from "@/lib/types";

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BusinessStep({ formData, onUpdate, onNext }: StepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.businessName?.trim()) {
      newErrors.businessName = "Business name is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
          Tell us about your business
        </h2>
        <p className="text-white-secondary">
          A few details help us build a plan that fits where you are today.
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
            id="business-name"
            label="Business name"
            placeholder="Your business name"
            value={formData.businessName || ""}
            error={errors.businessName}
            onChange={(e) => {
              onUpdate({ businessName: e.target.value });
              if (errors.businessName) {
                setErrors((prev) => ({ ...prev, businessName: "" }));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleContinue();
              }
            }}
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Select
            id="business-age"
            label="How long have you been in business?"
            options={businessAgeOptions}
            placeholder="Select..."
            value={formData.businessAge || ""}
            onChange={(e) =>
              onUpdate({
                businessAge: e.target.value as IntakeFormData["businessAge"],
              })
            }
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Select
            id="team-size"
            label="How many people are on your team?"
            options={teamSizeOptions}
            placeholder="Select..."
            value={formData.teamSize || ""}
            onChange={(e) =>
              onUpdate({
                teamSize: e.target.value as IntakeFormData["teamSize"],
              })
            }
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Select
            id="revenue-range"
            label="Annual revenue range"
            options={revenueRangeOptions}
            placeholder="Select..."
            value={formData.revenueRange || ""}
            onChange={(e) =>
              onUpdate({
                revenueRange: e.target.value as IntakeFormData["revenueRange"],
              })
            }
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Button
            onClick={handleContinue}
            className="w-full"
            size="lg"
          >
            Continue
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
