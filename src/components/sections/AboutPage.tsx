"use client";

import Image from "next/image";
import { Rocket, TrendingUp, Handshake } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { HeroEntranceItem, PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import {
  Section,
  Container,
  Eyebrow,
  Heading,
  BookCallButton,
  CallTerms,
} from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";

const VALUES = [
  {
    icon: Rocket,
    title: "Start with the right problem",
    description:
      "We learn the operation before recommending a tool, workflow, agent, training program, or integrated system.",
  },
  {
    icon: TrendingUp,
    title: "Build for the real business",
    description:
      "The work fits the tools, language, approvals, and people already in place, with documentation the team can use.",
  },
  {
    icon: Handshake,
    title: "Stay through execution",
    description:
      "We can train the team, run the agreed work, measure what changes, and improve the solution after launch.",
  },
];

const NARRATIVE = [
  {
    label: "the resume",
    body: (
      <p>
        Twelve years building software companies. Products past a hundred thousand users, a venture
        round, and a marketplace that still runs.
      </p>
    ),
  },
  {
    label: "the real story",
    body: (
      <>
        <p>
          But resumes don&apos;t tell you much. What matters is why Accelerate exists. I have seen
          up close how much revenue small businesses lose to slow follow-up, missed inquiries, and
          websites that look fine but bring in nothing. It is not a theoretical problem to me.
        </p>
        <p>
          So I built the systems those businesses actually needed, and they worked. Then other
          owners started asking, &ldquo;Can you set that up for me too?&rdquo;
        </p>
      </>
    ),
  },
  {
    label: "the approach",
    body: (
      <>
        <p>
          We&apos;re not trying to be the biggest agency. We take on a limited number of clients so
          we can actually operate alongside each one. When your AI agent gives a wrong answer at 11
          PM, we fix it by morning. When your pipeline dips, we dig into the data before you even
          notice.
        </p>
        <p className="font-medium text-white-primary">
          This isn&apos;t a set-it-and-forget-it shop. We&apos;re on the hook after launch, which is
          the only part that is hard.
        </p>
      </>
    ),
  },
];

function FounderCard() {
  return (
    <div className="border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] p-7 text-center">
      <div className="relative mx-auto mb-5 h-44 w-44 overflow-hidden bg-[var(--bg-subtle)]">
        <Image
          src="/images/john.jpg"
          alt="John Connor, Founder of Accelerate"
          width={176}
          height={176}
          className="h-full w-full object-cover"
        />
      </div>
      <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-heading">
        John Connor
      </h2>
      <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white-muted">
        Founder
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white-muted">
        Tech builder. Business owner. Operator.
      </p>
    </div>
  );
}

export function AboutPageContent() {
  return (
    <>
      {/* hero — portrait-led split: the founder's face is the signature visual,
          unique to this page (every other page leads with the ops console). */}
      <PublicHeroEntrance className="page-offset-roomy relative overflow-hidden pb-24">
        <Container width="wide">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <div className="min-w-0">
              <HeroEntranceItem step={1}>
                <Eyebrow className="mb-7">about accelerate</Eyebrow>
              </HeroEntranceItem>
              <HeroEntranceItem step={2}>
                <RevealHeading
                  as="h1"
                  className={HERO_HEADING}
                  lead="AI should fit the business,"
                  accent="not the other way around."
                  entrance="parent"
                />
              </HeroEntranceItem>
              <HeroEntranceItem step={3}>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                  We combine strategy, engineering, and hands-on execution. We help a team decide
                  where AI belongs, build the right custom solution, and stay involved until it
                  works in the real operation.
                </p>
              </HeroEntranceItem>
            </div>
            <HeroEntranceItem step={3} className="mx-auto w-full max-w-sm">
              <FounderCard />
            </HeroEntranceItem>
          </div>
        </Container>
      </PublicHeroEntrance>

      {/* origin story — a focused reading column (the face already lives above) */}
      <Section width="text" divide>
        <Eyebrow className="mb-8">the origin story</Eyebrow>
        <div className="flex flex-col gap-12">
          {NARRATIVE.map((seg, i) => (
            <AnimateOnScroll key={seg.label} delay={i * 0.06}>
              <div className="border-l border-[color-mix(in_srgb,var(--fg)_18%,transparent)] pl-6">
                <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-white-muted">
                  {seg.label}
                </p>
                <div className="flex flex-col gap-4 text-base leading-relaxed text-white-secondary">
                  {seg.body}
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </Section>

      {/* mission — single statement card */}
      <Section width="text" divide>
        <AnimateOnScroll>
          <div className="border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] p-8 text-center sm:p-12">
            <Eyebrow className="mb-6 inline-block">our mission</Eyebrow>
            <p className="font-display text-2xl leading-relaxed text-white-primary sm:text-3xl">
              Useful AI starts with understanding the work. We find where time is being consumed or
              revenue is being missed, then choose the smallest solution that can make a meaningful
              difference.
            </p>
          </div>
        </AnimateOnScroll>
      </Section>

      {/* values — no fabricated metrics, just the principles */}
      <Section width="wide" divide>
        <Eyebrow className="mb-6">what we stand for</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          Three principles, every project.
        </Heading>
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUES.map((v, i) => {
            const Icon = v.icon;
            return (
              <AnimateOnScroll
                key={v.title}
                delay={i * 0.08}
                as="div"
                className="flex h-full flex-col gap-4 border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] p-6"
              >
                <span className="grid h-11 w-11 place-items-center border border-[color-mix(in_srgb,var(--fg)_14%,transparent)]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="font-display text-xl font-bold tracking-[-0.01em] text-heading">
                  {v.title}
                </h3>
                <p className="text-sm leading-relaxed text-white-secondary">{v.description}</p>
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
            <Heading size={1} as="h2">
              Let&apos;s see if we&apos;re a fit.
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Thirty minutes about how the business works, what the team wants to change, and where
              AI or automation may be useful.
            </p>
            <BookCallButton location="about" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
