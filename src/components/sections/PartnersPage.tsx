"use client";

import { useState } from "react";
import {
  Handshake, DollarSign, Rocket, Check, ArrowRight, Loader2,
  Building2, Globe, Cpu, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Section, Container, Eyebrow, Heading, BookCallButton, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { HeroEntranceItem, PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import { partnerTiers } from "@/content/partners";
import { cn } from "@/lib/utils";
import { trackConversion } from "@/lib/analytics";
import { getUTMParams, clearUTMParams } from "@/lib/utm";

const tierIcons: Record<string, LucideIcon> = {
  "Referral Partner": Users,
  "Agency Partner": Building2,
  "Technology Partner": Cpu,
};

const WHY = [
  { icon: DollarSign, title: "Earn commission",  desc: "Up to 20% on every client you refer. Paid monthly with full transparency." },
  { icon: Handshake,  title: "White-label option", desc: "Deliver our services under your brand with wholesale pricing." },
  { icon: Rocket,     title: "Grow your business", desc: "Add AI solutions to your offering without building the technology yourself." },
];

const TYPE_OPTIONS = [
  { value: "referral" as const,   label: "Referral",   icon: Users },
  { value: "agency" as const,     label: "Agency",     icon: Building2 },
  { value: "technology" as const, label: "Technology", icon: Globe },
];

export function PartnersPage() {
  const [formData, setFormData] = useState({
    name: "", email: "", company: "", website: "",
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
        body: JSON.stringify({ ...formData, utm: getUTMParams() }),
      });
      if (!res.ok) throw new Error("Request failed");
      trackConversion("Partner Applied", { partner_type: formData.partnerType });
      clearUTMParams();
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or email us at partners@acceleratewith.us.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* hero — statement + the financial hook front and center */}
      <PublicHeroEntrance className="page-offset-roomy relative overflow-hidden pb-24">
        <Container width="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="min-w-0">
            <HeroEntranceItem step={1}><Eyebrow className="mb-7">partner program</Eyebrow></HeroEntranceItem>
            <HeroEntranceItem step={2}><RevealHeading
              as="h1"
              className={HERO_HEADING}
              lead="Add AI to your offering."
              accent="Keep the revenue."
              entrance="parent"
            /></HeroEntranceItem>
            <HeroEntranceItem step={3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                Refer clients or white-label our work. We design, build, and run
                the AI systems, accountable to results, so your name stays on the
                win. Earn recurring revenue for as long as they stay.
              </p>
            </HeroEntranceItem>
          </div>
          <HeroEntranceItem step={3} className="mx-auto w-full max-w-sm">
            <div className="relative overflow-hidden border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] p-8">
              <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-white-muted">Partner earnings</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-6xl font-extrabold leading-none tracking-[-0.03em] text-heading">20%</span>
                <span className="font-display text-lg font-semibold leading-tight text-heading">recurring<br />commission</span>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-white-secondary">
                On every client you refer, paid monthly, for as long as they
                stay with us.
              </p>
              <div className="mt-6 border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] pt-4 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white-muted">
                Referral · Agency · White-label · Technology
              </div>
            </div>
          </HeroEntranceItem>
        </div>
        </Container>
      </PublicHeroEntrance>

      {/* why partner */}
      <Section width="wide" divide>
        <Eyebrow className="mb-6">why partner</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-2xl">
          A real partnership.
        </Heading>
        <div className="grid gap-5 sm:grid-cols-3">
          {WHY.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex h-full flex-col gap-4 rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-6 backdrop-blur-md"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] text-gold">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <h3 className="font-display text-xl font-bold tracking-[-0.01em] text-heading">{title}</h3>
              <p className="text-sm leading-relaxed text-white-secondary">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* partner tiers */}
      <Section width="wide" divide>
        <Eyebrow className="mb-6">partner tiers</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          Three ways to partner.
        </Heading>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {partnerTiers.map((tier, i) => {
            const Icon = tierIcons[tier.name] || Users;
            const featured = i === 1;
            return (
              <div
                key={tier.name}
                className={cn(
                  "flex h-full flex-col rounded-2xl border bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] p-6 backdrop-blur-md sm:p-7",
                  featured
                    ? "border-border-gold shadow-[0_0_0_1px_var(--border-gold),inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.25)]"
                    : "border-border-glass shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                )}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] text-gold">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="font-display text-lg font-bold tracking-[-0.01em] text-heading">{tier.name}</h3>
                </div>
                <p className={cn("mb-5 text-sm font-medium", featured ? "text-gold" : "text-gold-light")}>
                  {tier.commission}
                </p>
                <div className="mb-5">
                  <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white-muted">Benefits</p>
                  <ul className="flex flex-col gap-2">
                    {tier.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-white-secondary">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto border-t border-border-glass pt-4">
                  <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-white-muted">Requirements</p>
                  <ul className="flex flex-col gap-1">
                    {tier.requirements.map((r) => (
                      <li key={r} className="text-xs text-white-muted">· {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* application form */}
      <Section width="text" divide>
        <div id="apply" className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-md sm:p-10">
          {submitted ? (
            <div className="py-6 text-center">
              <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-gold text-btn-text">
                <Check className="h-8 w-8" strokeWidth={2.5} />
              </span>
              <h2 className="mb-2 font-display text-2xl font-bold text-heading">Application received</h2>
              <p className="text-white-secondary">
                Thanks for your interest. We review applications within 2 business
                days and will be in touch soon.
              </p>
            </div>
          ) : (
            <>
              <Eyebrow className="mb-5">apply to partner</Eyebrow>
              <h2 className="mb-2 font-display text-2xl font-bold text-heading">Tell us about your business</h2>
              <p className="mb-7 text-white-muted">A few quick details and we&apos;ll be in touch.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Your name *"   placeholder="Jane Smith"        value={formData.name}    onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}    required />
                  <Input label="Email *"       type="email" placeholder="jane@agency.com" value={formData.email}   onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}   required />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Company *"     placeholder="Your company name" value={formData.company} onChange={(e) => setFormData((d) => ({ ...d, company: e.target.value }))} required />
                  <Input label="Website"       placeholder="https://yourcompany.com" value={formData.website} onChange={(e) => setFormData((d) => ({ ...d, website: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white-secondary">Partner type *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {TYPE_OPTIONS.map((opt) => {
                      const on = formData.partnerType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormData((d) => ({ ...d, partnerType: opt.value }))}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-sm transition-colors",
                            on
                              ? "border-border-gold bg-[color-mix(in_srgb,var(--gold-base)_10%,transparent)] text-heading"
                              : "border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)]"
                          )}
                        >
                          <opt.icon className={cn("h-5 w-5", on ? "text-gold" : "text-white-muted")} />
                          {opt.label}
                        </button>
                      );
                    })}
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
                {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-cursor="link"
                  className="group mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-btn-text transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                  ) : (
                    <>Submit application <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </Section>

      {/* closing — master style */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Questions about partnering?
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Let&apos;s talk about how we can work together to deliver AI
              solutions to your clients.
            </p>
            <BookCallButton location="partners" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
