"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Handshake,
  DollarSign,
  Users,
  Rocket,
  Check,
  ArrowRight,
  Loader2,
  Building2,
  Globe,
  Cpu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";


import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { partnerTiers } from "@/content/partners";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

const tierIcons: Record<string, LucideIcon> = {
  "Referral Partner": Users,
  "Agency Partner": Building2,
  "Technology Partner": Cpu,
};

export function PartnersPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    website: "",
    partnerType: "referral" as "referral" | "agency" | "technology",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.email || !formData.company || !formData.message) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/partner-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Request failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or email us at partners@acceleratewith.us.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-base)] mb-4">
            Partner Program
          </p>
          <h1
            className="font-display text-3xl md:text-5xl font-bold text-white-primary mb-4"
          >
            Grow Together,{" "}
            <span className="text-gold-gradient">Earn Together</span>
          </h1>
          <p className="text-lg text-white-secondary max-w-2xl mx-auto">
            Whether you are a consultant, agency, or technology company, partner
            with Accelerate to deliver AI solutions to your clients while earning
            recurring revenue.
          </p>
        </motion.div>

        {/* Why Partner */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-20"
        >
          {[
            { icon: DollarSign, title: "Earn Commission", desc: "Up to 20% on every client you refer. Paid monthly with full transparency." },
            { icon: Handshake, title: "White-Label Option", desc: "Deliver our services under your brand with wholesale pricing." },
            { icon: Rocket, title: "Grow Your Business", desc: "Add AI solutions to your offering without building the technology." },
          ].map((item) => (
            <motion.div key={item.title} variants={fadeUp}>
              <GlassCard variant="prominent" padding="lg" className="text-center h-full">
                <div className="w-12 h-12 rounded-lg bg-gold-gradient flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-black" />
                </div>
                <h3
                  className="font-display text-lg font-bold text-white-primary mb-2"
                >
                  {item.title}
                </h3>
                <p className="text-sm text-white-secondary">{item.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Partner Tiers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h2
            className="font-display text-2xl md:text-3xl font-bold text-white-primary text-center mb-10"
          >
            Partner Tiers
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {partnerTiers.map((tier, i) => {
              const Icon = tierIcons[tier.name] || Users;
              return (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <GlassCard
                    variant={i === 1 ? "gold" : "prominent"}
                    padding="lg"
                    className={cn("h-full flex flex-col", i === 1 && "border-gold-glow")}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon className="w-5 h-5 text-[var(--gold-base)]" />
                      <h3
                        className="font-display text-lg font-bold text-white-primary"
                      >
                        {tier.name}
                      </h3>
                    </div>
                    <p className="text-sm text-[var(--gold-light)] font-medium mb-4">
                      {tier.commission}
                    </p>

                    <div className="mb-4">
                      <p className="text-xs text-white-muted uppercase tracking-wider mb-2">Benefits</p>
                      <ul className="space-y-2">
                        {tier.benefits.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-sm text-white-secondary">
                            <Check className="w-4 h-4 text-[var(--gold-base)] shrink-0 mt-0.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-auto pt-4 border-t border-[var(--border-glass)]">
                      <p className="text-xs text-white-muted uppercase tracking-wider mb-2">Requirements</p>
                      <ul className="space-y-1">
                        {tier.requirements.map((r) => (
                          <li key={r} className="text-xs text-white-muted">
                            &bull; {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Application Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          id="apply"
          className="max-w-2xl mx-auto"
        >
          <GlassCard variant="prominent" padding="lg">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-gold-gradient flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-black" />
                </div>
                <h2
                  className="font-display text-2xl font-bold text-white-primary mb-2"
                >
                  Application Received
                </h2>
                <p className="text-white-secondary">
                  Thank you for your interest. We review applications within 2 business days
                  and will be in touch soon.
                </p>
              </div>
            ) : (
              <>
                <h2
                  className="font-display text-2xl font-bold text-white-primary mb-2 text-center"
                >
                  Apply to Partner
                </h2>
                <p className="text-white-secondary text-center mb-8">
                  Tell us about yourself and how you&rsquo;d like to work together.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Your Name *"
                      placeholder="Jane Smith"
                      value={formData.name}
                      onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                      required
                    />
                    <Input
                      label="Email *"
                      type="email"
                      placeholder="jane@agency.com"
                      value={formData.email}
                      onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Company *"
                      placeholder="Your Company Name"
                      value={formData.company}
                      onChange={(e) => setFormData((d) => ({ ...d, company: e.target.value }))}
                      required
                    />
                    <Input
                      label="Website"
                      placeholder="https://yourcompany.com"
                      value={formData.website}
                      onChange={(e) => setFormData((d) => ({ ...d, website: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white-secondary mb-2">
                      Partner Type *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: "referral" as const, label: "Referral", icon: Users },
                        { value: "agency" as const, label: "Agency", icon: Building2 },
                        { value: "technology" as const, label: "Technology", icon: Globe },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormData((d) => ({ ...d, partnerType: opt.value }))}
                          className={cn(
                            "flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm",
                            formData.partnerType === opt.value
                              ? "border-[var(--border-gold)] bg-[var(--glass-gold-bg)] text-white-primary border-gold-glow"
                              : "glass border-[var(--border-glass)] text-white-secondary hover:border-[var(--border-glass-hover)]"
                          )}
                        >
                          <opt.icon className={cn(
                            "w-5 h-5",
                            formData.partnerType === opt.value ? "text-[var(--gold-base)]" : "text-white-muted"
                          )} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    label="Tell us about your business and how you'd like to partner *"
                    placeholder="What services do you offer? How many clients do you work with? What excites you about partnering with Accelerate?"
                    value={formData.message}
                    onChange={(e) => setFormData((d) => ({ ...d, message: e.target.value }))}
                    className="min-h-[120px]"
                    required
                  />

                  {error && <p role="alert" className="text-[var(--error)] text-sm">{error}</p>}

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Application
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
