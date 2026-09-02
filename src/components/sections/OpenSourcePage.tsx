"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/Accordion";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { CodeBlock } from "@/components/mdx/CodeBlock";
import { CaseMedia } from "@/components/work/CaseMedia";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import { ProductSlider } from "@/components/media/ProductSlider";
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
import {
  OPEN_SOURCE_PATHS,
  OPEN_SOURCE_STATS,
  TECH_STACK,
  QUICK_START,
  openSourceFaqs,
} from "@/content/open-source";
import type { OpenSourcePath } from "@/content/open-source";
import { PRODUCT_SCREENSHOTS } from "@/content/product-screenshots";
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

const MORE_SCREENS_INDEXES = [2, 3, 4];

function MoreScreens() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-3">
        {MORE_SCREENS_INDEXES.map((screenshotIndex, i) => {
          const screenshot = PRODUCT_SCREENSHOTS[screenshotIndex]!;
          return (
            <CaseMedia
              key={screenshot.src}
              media={screenshot}
              aspect="wide"
              revealDelay={i * 0.06}
              onOpen={() => {
                returnFocus.current = document.activeElement as HTMLElement;
                setLightboxIndex(screenshotIndex);
              }}
            />
          );
        })}
      </div>
      <MediaLightbox
        media={PRODUCT_SCREENSHOTS}
        activeIndex={lightboxIndex}
        groupLabel="Command Center screens"
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        returnFocus={returnFocus}
      />
    </>
  );
}

export function OpenSourcePageContent() {
  return (
    <>
      <PublicHeroEntrance className="page-offset-roomy relative overflow-hidden pb-20">
        <Container width="wide">
          <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="min-w-0">
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
                  Contacts, pipeline, inbox, proposals, and an AI layer that actually knows the
                  business: most service businesses build all of it from scratch. This is that
                  backend, already built and running a real agency, published under the MIT license.
                  Run it yourself and own every part of it, or have us build and run a custom
                  version for your business.
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
            <HeroEntranceItem step={3} className="relative min-w-0">
              <ProductSlider slides={PRODUCT_SCREENSHOTS} groupLabel="Command Center screens" />
            </HeroEntranceItem>
          </div>
        </Container>
      </PublicHeroEntrance>

      {/* stats */}
      <Section width="wide" className="pt-0">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-10 sm:grid-cols-4">
          {OPEN_SOURCE_STATS.map((stat, i) => (
            <AnimateOnScroll key={stat.label} as="div" delay={i * 0.05} className="text-center">
              <p className="font-display text-4xl font-extrabold tracking-[-0.02em] text-heading sm:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm font-semibold text-white-secondary">{stat.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-white-muted">{stat.detail}</p>
            </AnimateOnScroll>
          ))}
        </div>
      </Section>

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

      {/* quick start */}
      <Section width="wide" divide>
        <div className="grid min-w-0 items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="min-w-0">
            <Eyebrow className="mb-6">running in minutes</Eyebrow>
            <Heading size={2} as="h2" className="max-w-md">
              Four commands to a running workspace.
            </Heading>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white-muted">
              The public site and fictional demo run with zero external services. Connecting a real
              workspace with your own Supabase project is a second step, fully documented in the
              repository.
            </p>
            <a
              href="https://github.com/JohnConnorCode/accelerate-site/blob/main/docs/SELF-HOSTING.md"
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="link"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white-secondary underline-offset-4 transition-colors hover:text-gold hover:underline"
            >
              Read the self-hosting docs
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <AnimateOnScroll as="div" delay={0.08} className="min-w-0">
            <CodeBlock language="bash" title="terminal">
              {QUICK_START}
            </CodeBlock>
            <div className="mt-8 flex flex-wrap gap-2">
              {TECH_STACK.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-[color-mix(in_srgb,var(--fg)_16%,transparent)] px-3.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white-muted"
                >
                  {tech}
                </span>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </Section>

      {/* why the source is open */}
      <Section width="wide" divide className="bg-[var(--bg-section-warm)]">
        <div className="grid min-w-0 gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
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
              {
                title: "A foundation, not a template",
                body: "Fork it to run your own business, or as the starting point for client work you build and maintain.",
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

      {/* more screens */}
      <Section width="wide" divide>
        <Eyebrow className="mb-6">every screen</Eyebrow>
        <Heading size={2} as="h2" className="mb-3 max-w-2xl">
          Seven screens, seven appearances.
        </Heading>
        <p className="mb-10 max-w-2xl text-base leading-relaxed text-white-muted">
          The slider above is a preview, not the whole product. Open any screen full size, and arrow
          through the rest from there.
        </p>
        <MoreScreens />
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
