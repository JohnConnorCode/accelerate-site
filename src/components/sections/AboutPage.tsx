"use client";

import Image from "next/image";
import { Rocket, TrendingUp, Handshake } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";

const VALUES = [
  {
    icon: Rocket,
    title: "Ship fast, iterate faster",
    description:
      "We ship in weeks, not months. Your business can't wait for a six-month project timeline. We move fast, get you live, and optimize from real data instead of guesswork.",
  },
  {
    icon: TrendingUp,
    title: "Measure everything that matters",
    description:
      "We measure success by your growth, not our hours. Every project has clear metrics from day one, and we track them obsessively so you always know what's working.",
  },
  {
    icon: Handshake,
    title: "Earn it every month",
    description:
      "No vanity metrics. No overblown promises. We earn your business every single month by delivering results you can see in your bank account.",
  },
];

const NARRATIVE = [
  {
    label: "the resume",
    body: (
      <p>
        Over a decade building technology platforms. Drove 15x revenue growth to
        300K+ monthly active users at Upland. Raised over $1M for Sparkblox
        through partnerships with Chainlink and Algorand. Built HelpWith to
        3,000+ service providers across four markets.
      </p>
    ),
  },
  {
    label: "the real story",
    body: (
      <>
        <p>
          But resumes don&apos;t tell you much. Here&apos;s what matters: I also
          run a roofing company in Mississippi. I&apos;ve sat across the table
          from a homeowner trying to close a deal. I&apos;ve missed calls because
          I was up on a roof. I&apos;ve wasted money on a website that looked
          pretty and generated zero calls.
        </p>
        <p>
          That frustration is why Accelerate exists. I built the tools I wished I
          had — and they worked. Then contractors I know started asking,
          &ldquo;Can you set that up for me too?&rdquo;
        </p>
      </>
    ),
  },
  {
    label: "the approach",
    body: (
      <>
        <p>
          We&apos;re not trying to be the biggest agency. We take on a limited
          number of clients so we can actually operate alongside each one. When
          your AI agent gives a wrong answer at 11 PM, we fix it by morning.
          When your pipeline dips, we dig into the data before you even notice.
        </p>
        <p className="font-medium italic text-white-primary">
          This isn&apos;t a set-it-and-forget-it shop. We&apos;re in the business
          of your results.
        </p>
      </>
    ),
  },
];

function FounderCard() {
  return (
    <div className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
      <div className="relative mx-auto mb-4 h-32 w-32 overflow-hidden rounded-xl border border-border-glass bg-bg-subtle">
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-gold-light"
        >
          JC
        </span>
        <Image
          src="/images/john.jpg"
          alt="John Connor — Founder of Accelerate"
          width={128}
          height={128}
          className="relative z-10 h-full w-full object-cover"
        />
      </div>
      <h2 className="font-display text-xl font-bold text-heading">John Connor</h2>
      <p className="mt-1 text-sm font-medium text-gold">Founder</p>
      <p className="mt-2 text-xs text-white-muted">
        Tech builder. Business owner. Roofer (seriously).
      </p>
    </div>
  );
}

export function AboutPageContent() {
  return (
    <>
      {/* hero */}
      <Section width="wide" className="pt-32">
        <div className="max-w-3xl">
          <Eyebrow className="mb-7">about</Eyebrow>
          <Heading size={1} as="h1" className="text-[clamp(2.4rem,4.6vw,4.75rem)] leading-[1.02]">
            Built by a business owner,{" "}
            <Heading.Italic>for business owners.</Heading.Italic>
          </Heading>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
            We&apos;re not a tech company that sells to small businesses.
            We&apos;re small business operators who build technology — that
            changes everything about how we work.
          </p>
        </div>
      </Section>

      {/* origin: sticky founder card + scrolling narrative */}
      <Section width="wide" divide>
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <AnimateOnScroll>
              <FounderCard />
            </AnimateOnScroll>
          </div>
          <div className="flex flex-col gap-14 lg:col-span-2">
            {NARRATIVE.map((seg, i) => (
              <AnimateOnScroll key={seg.label} delay={i * 0.08}>
                <Eyebrow className="mb-4">{seg.label}</Eyebrow>
                <div className="flex flex-col gap-4 text-base leading-relaxed text-white-secondary">
                  {seg.body}
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </Section>

      {/* mission — single statement card */}
      <Section width="text" divide>
        <AnimateOnScroll>
          <div className="rounded-2xl border border-border-gold/40 bg-[color-mix(in_srgb,var(--gold-base)_5%,var(--bg-elevated))] p-8 text-center backdrop-blur-md sm:p-12">
            <Eyebrow className="mb-6 inline-block">our mission</Eyebrow>
            <p className="font-display text-2xl leading-relaxed text-white-primary sm:text-3xl">
              Give small businesses the same AI-powered growth tools that
              Fortune 500 companies use — without the enterprise budget, the
              six-month timeline, or the 47-slide strategy deck.
            </p>
          </div>
        </AnimateOnScroll>
      </Section>

      {/* values — no fabricated metrics, just the principles */}
      <Section width="wide" divide>
        <Eyebrow className="mb-6">what we stand for</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          Three principles, <Heading.Italic>every project.</Heading.Italic>
        </Heading>
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUES.map((v, i) => {
            const Icon = v.icon;
            return (
              <AnimateOnScroll
                key={v.title}
                delay={i * 0.08}
                as="div"
                className="flex h-full flex-col gap-4 rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-6 backdrop-blur-md"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] text-gold">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="font-display text-xl font-bold tracking-[-0.01em] text-heading">
                  {v.title}
                </h3>
                <p className="text-sm leading-relaxed text-white-secondary">
                  {v.description}
                </p>
              </AnimateOnScroll>
            );
          })}
        </div>
      </Section>

      {/* closing — master style */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2" className="text-[clamp(2.6rem,5.4vw,5.5rem)] leading-[0.98]">
              Let&apos;s see if we&apos;re a <Heading.Italic>fit.</Heading.Italic>
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              No pitch deck. No 12-email sequence. Just a 30-minute conversation
              about your business.
            </p>
            <BookCallButton />
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted">
              <span>Free</span><span>·</span>
              <span>30 minutes</span><span>·</span>
              <span>No obligation</span><span>·</span>
              <span>Direct to the founder</span>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
