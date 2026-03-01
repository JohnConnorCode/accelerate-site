"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

interface FormData {
  name: string;
  email: string;
  phone: string;
  businessType: string;
  message: string;
}

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    businessType: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/send-contact-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to send message. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (submitted) {
    return (
      <GlassCard variant="prominent" padding="lg" className="text-center">
        <div className="py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-gold-gradient mx-auto flex items-center justify-center">
            <Send className="w-8 h-8 text-black" />
          </div>
          <h3
            className="text-2xl font-bold text-white"
            style={{
              fontFamily:
                "var(--font-space-grotesk), var(--font-inter), sans-serif",
            }}
          >
            Message Sent
          </h3>
          <p className="text-white/65 max-w-md mx-auto">
            Thanks for reaching out. We will get back to you within one business
            day.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="prominent" padding="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[var(--white-secondary)] mb-1.5">
            Name
          </label>
          <Input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--white-secondary)] mb-1.5">
            Email
          </label>
          <Input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-[var(--white-secondary)] mb-1.5">
            Phone
          </label>
          <Input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <label htmlFor="businessType" className="block text-sm font-medium text-[var(--white-secondary)] mb-1.5">
            Business Type
          </label>
          <Select
            id="businessType"
            name="businessType"
            required
            value={formData.businessType}
            onChange={handleChange}
            placeholder="Select your industry"
            options={[
              { value: "home_services", label: "Home Services" },
              { value: "law_firm", label: "Law Firm" },
              { value: "professional_services", label: "Professional Services" },
              { value: "real_estate", label: "Real Estate" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-[var(--white-secondary)] mb-1.5">
            Message
          </label>
          <Textarea
            id="message"
            name="message"
            required
            rows={4}
            value={formData.message}
            onChange={handleChange}
            placeholder="Tell us about your business and what you're looking for..."
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              Sending...
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            </>
          ) : (
            <>
              Send Message
              <Send className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>
    </GlassCard>
  );
}
