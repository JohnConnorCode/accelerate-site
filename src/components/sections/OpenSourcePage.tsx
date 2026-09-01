"use client";

import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Accordion";
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
import { cn } from "@/lib/utils";
import { OPEN_SOURCE_PATHS, openSourceFaqs } from "@/content/open-source";
import type { OpenSourcePath } from "@/content/open-source";
import { trackConversion } from "@/lib/analytics";

function PathCard({ path, index }: { path: OpenSourcePath; index: number }) {
  return (
    <AnimateOnScroll as="div" delay={index * 0.06} className="flex h-full flex-col">
      <div
        id={path.id}
        className="flex h-full flex-1 flex-col rounded-[24px] border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] p-6 sm:p-8"
      >
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-white-muted">
          {path.eyebrow}
        </p>
        <h2 className="mt-4 font-display text-2xl font-bold tracking-[-0.02em] text-heading">
          {path.title}
        </h2>
        <p className="mt-1 text-sm text-white-muted">{path.scope}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-white-secondary">{path.description}</p>
        <div className="my-6 border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)]" />
        <ul className="mb-8 flex flex-1 flex-col gap-3" role="list">
          {path.included.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-heading"
                strokeWidth={2.5}
                aria-hidden
              />
              <span className="text-sm leading-relaxed text-white-secondary">{item}</span>
            </li>
          ))}
        </ul>
        {path.external ? (
          <a
            href={path.ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="link"
            onClick={() => trackConversion("Open Source Path Selected", { path: path.id })}
            className="btn w-full justify-center"
          >
            {path.ctaText}
            <ArrowUpRight className="h-4 w-4" />
          </a>
        ) : (
          <Link
            href={path.ctaHref}
            data-cursor="link"
            onClick={() => trackConversion("Open Source Path Selected", { path: path.id })}
            className="btn w-full justify-center"
          >
            {path.ctaText}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </AnimateOnScroll>
  );
}

export function OpenSourcePageContent() {
  return (
    <>
      <PublicHeroEntrance className="page-offset-roomy relative overflow-hidden pb-20">
        <Container width="wide">
          <div className="min-w-0 max-w-3xl">
            <HeroEntranceItem step={1}>
              <Eyebrow className="mb-7">open source</Eyebrow>
            </HeroEntranceItem>
            <HeroEntranceItem step={2}>
              <RevealHeading
                as="h1"
                className={HERO_HEADING}
                lead="The Command Center is"
                accent="open source."
                entrance="parent"
              />
            </HeroEntranceItem>
            <HeroEntranceItem step={3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                The application behind our own agency, real code that runs a real business, is
                published under the MIT license. Run it yourself and own every part of it, or have
                us build and run a custom version for your business.
              </p>
            </HeroEntranceItem>
            <HeroEntranceItem step={4}>
              <div className="mt-9 flex flex-wrap items-center gap-6">
                <a
                  href="https://github.com/JohnConnorCode/accelerate-site"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor="link"
                  onClick={() => trackConversion("Open Source Hero GitHub Click")}
                  className="btn"
                >
                  View the repository
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <Link
                  href="/command-center"
                  data-cursor="link"
                  className="text-sm font-medium text-white-secondary underline-offset-4 transition-colors hover:text-gold hover:underline"
                >
                  See the full product
                </Link>
              </div>
            </HeroEntranceItem>
          </div>
        </Container>
      </PublicHeroEntrance>

      {/* two paths */}
      <Section width="wide">
        <Eyebrow className="mb-6">two ways to run it</Eyebrow>
        <Heading size={2} as="h2" className="mb-3 max-w-2xl">
          Read the code, or start with a conversation.
        </Heading>
        <p className="mb-10 max-w-2xl text-base leading-relaxed text-white-muted">
          Neither path is the default. Self-hosting and a managed build solve different problems,
          and you can move between them as the business changes.
        </p>
        <div className="grid items-stretch gap-6 md:grid-cols-2 lg:gap-8">
          {OPEN_SOURCE_PATHS.map((path, index) => (
            <PathCard key={path.id} path={path} index={index} />
          ))}
        </div>
      </Section>

      {/* why the source is open */}
      <Section width="wide" divide className="bg-[var(--bg-section-warm)]">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow className="mb-6">why it&apos;s open</Eyebrow>
            <Heading size={2} as="h2" className="max-w-lg">
              Own your data. Own your AI spend.
            </Heading>
          </div>
          <ul className="flex flex-col gap-6" role="list">
            {[
              {
                title: "Records you control",
                body: "Your data lives in a Supabase project you own and can move at any time.",
              },
              {
                title: "AI spend billed to you",
                body: "Connect your own OpenRouter key so model usage bills directly to you, at provider cost.",
              },
              {
                title: "Open to inspection",
                body: "Tenant isolation and every AI write are documented, tested, and readable in the source.",
              },
            ].map((item, i) => (
              <li
                key={item.title}
                className={cn(
                  "border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] pt-5",
                  i === 0 && "border-t-0 pt-0",
                )}
              >
                <AnimateOnScroll as="div" delay={i * 0.06}>
                  <h3 className="font-display text-lg font-semibold text-heading">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white-muted">{item.body}</p>
                </AnimateOnScroll>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* faqs */}
      <Section width="text" divide>
        <Eyebrow className="mb-6">frequently asked</Eyebrow>
        <Heading size={2} as="h2" className="mb-3 max-w-3xl">
          Questions, answered.
        </Heading>
        <p className="mb-10 max-w-xl text-base leading-relaxed text-white-muted">
          Everything you need to know about self-hosting and the managed build.
        </p>
        <AnimateOnScroll>
          <Accordion type="single" collapsible>
            {openSourceFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimateOnScroll>
        <p className="mt-8 text-center text-sm text-white-muted">
          Don&apos;t see your question?{" "}
          <a
            href="mailto:john@acceleratewith.us"
            data-cursor="link"
            className="underline underline-offset-4"
          >
            john@acceleratewith.us
          </a>
        </p>
      </Section>

      {/* closing */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Book the session. Keep the plan.
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              A free strategy session with the engineers who would build it. We&apos;ll scope
              exactly what a managed build looks like for your business. You leave with a written
              plan. Yours to keep either way.
            </p>
            <BookCallButton location="open_source_closing" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
