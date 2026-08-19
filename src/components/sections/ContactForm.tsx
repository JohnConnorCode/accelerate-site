"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { trackConversion } from "@/lib/analytics";
import { isValidEmail } from "@/lib/validation";
import { getUTMParams, clearUTMParams } from "@/lib/utm";

interface FormData {
  name: string;
  email: string;
  companyName: string;
  companyWebsite: string;
  businessType: string;
  primaryProblem: string;
  message: string;
}

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    companyName: "",
    companyWebsite: "",
    businessType: "",
    primaryProblem: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(formData.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/send-contact-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, utm: getUTMParams() }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message. Please try again.");
      }

      trackConversion("Contact Form Submitted", { business_type: formData.businessType });
      clearUTMParams();
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
            className="text-2xl font-bold text-heading"
            style={{
              fontFamily:
                "var(--font-jost), var(--font-inter), sans-serif",
            }}
          >
            On its way to John
          </h3>
          <p className="text-white-secondary max-w-md mx-auto">
            John will review the company and reply personally within one business day.
            Reply with two times that work for you and he will schedule the call directly.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="prominent" padding="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-white-secondary mb-1.5">
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

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="companyName" className="mb-1.5 block text-sm font-medium text-white-secondary">Company</label>
            <Input type="text" id="companyName" name="companyName" required value={formData.companyName} onChange={handleChange} placeholder="Company name" />
          </div>
          <div>
            <label htmlFor="companyWebsite" className="mb-1.5 block text-sm font-medium text-white-secondary">Website</label>
            <Input type="text" id="companyWebsite" name="companyWebsite" required value={formData.companyWebsite} onChange={handleChange} placeholder="company.com" />
          </div>
        </div>

        <div>
          <label htmlFor="primaryProblem" className="block text-sm font-medium text-white-secondary mb-1.5">Biggest revenue constraint</label>
          <Select id="primaryProblem" name="primaryProblem" required value={formData.primaryProblem} onChange={handleChange} placeholder="Choose the biggest constraint" options={[{ value: "lead_response", label: "Slow response to new inquiries" }, { value: "follow_up", label: "Follow-up is inconsistent" }, { value: "scheduling", label: "Scheduling takes too much back-and-forth" }, { value: "visibility", label: "No clear pipeline or source visibility" }, { value: "other", label: "Something else" }]} />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white-secondary mb-1.5">
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
          <label htmlFor="businessType" className="block text-sm font-medium text-white-secondary mb-1.5">
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
          <label htmlFor="message" className="block text-sm font-medium text-white-secondary mb-1.5">
            Message
          </label>
          <Textarea
            id="message"
            name="message"
            required
            rows={4}
            value={formData.message}
            onChange={handleChange}
            placeholder="A little context helps John prepare. What is happening now?"
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
          className="w-full transition-transform active:scale-[0.96]"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              Sending...
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            </>
          ) : (
            <>
              Request the revenue-leak audit
              <Send className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>
    </GlassCard>
  );
}
