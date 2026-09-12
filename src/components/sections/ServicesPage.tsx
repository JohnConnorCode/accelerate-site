"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Compass, Workflow, TrendingUp, BarChart3, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { HeroEntranceItem, PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import {
  Section,
  Container,
  Eyebrow,
  Heading,
  BookCallButton,
  useReveal,
  CallTerms,
} from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import { ApprovalQueue } from "@/components/command-center/ApprovalQueue";
import type { LiveQueueItem } from "@/components/command-center/ApprovalQueue";
import { marketingPositioning } from "@/content/marketing-positioning";
import { CATEGORY_META } from "@/content/command-center";
import { workProjects } from "@/content/work";
import {
  problemRows,
  buildGroups,
  buildCapabilities,
  integrationGroups,
  integrationClosing,
  engagementShapes,
  scopingPromise,
  featuredServiceWorkSlugs,
  commandCenterFraming,
} from "@/content/services-page";

const iconMap: Record<string, LucideIcon> = {
  strategy: Compass,
  build: Workflow,
  execute: TrendingUp,
  improve: BarChart3,
};

// Legacy catalog anchors the homepage modes route to: engagementModes hrefs
// (#strategy, #automation, #sales, #reporting) land on these mode cards.
const modeAnchors = ["strategy", "automation", "sales", "reporting"];

const SERVICE_QUEUE: LiveQueueItem[] = [
  {
    id: "scope",
    kind: "note",
    title: "Scope mapped to the operating constraint",
    because: "The sequence of work is ready for review.",
  },
  {
    id: "workflow",
    kind: "task",
    title: "Workflow build moved into testing",
    because: "The handoff is being tested against the real process.",
  },
  {
    id: "integration",
    kind: "deal",
    title: "Core tools connected",
    because: "The system can now pass the right context between teams.",
  },
  {
    id: "handoff",
    kind: "calendar",
    title: "Team handoff scheduled",
    because: "The people who run it are included before it goes live.",
  },
  {
    id: "improve",
    kind: "email",
    title: "Weekly improvement brief prepared",
    because: "The next useful change is waiting with the evidence.",
  },
];

const SECTIONS = [
  { id: "start", label: "Where we start" },
  { id: "how", label: "How we help" },
  { id: "build", label: "What we build" },
  { id: "platform", label: "Command Center" },
  { id: "stack", label: "Your tools" },
  { id: "work", label: "Selected work" },
];

const STEPS = [
  {
    n: "01",
    t: "The session",
    d: "Thirty minutes on how the business works, what the team wants to change, and where time or revenue is being lost.",
  },
  {
    n: "02",
    t: "The recommendation",
    d: "A written view of where AI fits, the right type of solution, what should happen first, and why.",
  },
  {
    n: "03",
    t: "The delivery",
    d: "We provide the agreed consulting, custom build, integrations, training, or managed execution against a clear scope.",
  },
  {
    n: "04",
    t: "The improvement",
    d: "When ongoing help makes sense, we operate the work, support the team, measure what changes, and keep improving it.",
  },
];

function ProblemBand() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="start" className="svc-band section-reveal scroll-mt-[126px]">
      <Container width="wide">
        <Eyebrow className="mb-6">where we start</Eyebrow>
        <Heading size={2} as="h2" className="mb-4 max-w-3xl">
          Where is the business losing time, revenue, or information?
        </Heading>
        <p className="mb-12 max-w-2xl text-base leading-relaxed text-white-muted">
          Every engagement opens here. We look at the operation as it actually runs before
          anyone talks about tools.
        </p>
        <div className="svc-problem-grid">
          {problemRows.map((row) => (
            <div key={row.title} className="svc-problem-row">
              <h3 className="svc-problem-title">{row.title}</h3>
              <p className="svc-problem-body">{row.body}</p>
            </div>
          ))}
        </div>
        <p className="svc-problem-closing">
          Sometimes the right answer is one automation. Sometimes it is an AI coworker, an
          internal application, an integration, training for the team, or simply changing the
          process. We figure that out before we build.
        </p>
      </Container>
    </section>
  );
}

function ModesBand() {
  const ref = useReveal<HTMLElement>();
  return (
    <section
      ref={ref}
      id="how"
      className="svc-band svc-band-warm section-reveal scroll-mt-[126px]"
    >
      <Container width="wide">
        <Eyebrow className="mb-6">how we help</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          Four ways we work with a business.
        </Heading>
        <div className="svc-mode-grid">
          {marketingPositioning.engagementModes.map((mode, index) => {
            const Icon = iconMap[mode.key];
            return (
              <Link
                key={mode.key}
                href={mode.href}
                id={modeAnchors[index]}
                scroll={false}
                data-cursor="link"
                className="svc-mode-card"
              >
                <span className="svc-mode-top">
                  <span className="svc-mode-number">{String(index + 1).padStart(2, "0")}</span>
                  {Icon && (
                    <span className="svc-mode-icon">
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                  )}
                </span>
                <span className="svc-mode-label">{mode.label}</span>
                <span className="svc-mode-title">{mode.title}</span>
                <span className="svc-mode-desc">{mode.description}</span>
                <span className="svc-mode-example">{mode.example}</span>
              </Link>
            );
          })}
        </div>
        <p className="svc-mode-capabilities">{buildCapabilities}</p>
      </Container>
    </section>
  );
}

function BuildBand() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="build" className="svc-band section-reveal scroll-mt-[126px]">
      <Container width="wide">
        <Eyebrow className="mb-6">what we build</Eyebrow>
        <Heading size={2} as="h2" className="mb-4 max-w-3xl">
          Systems people can picture.
        </Heading>
        <p className="mb-12 max-w-2xl text-base leading-relaxed text-white-muted">
          Concrete examples of work we deliver. Most projects start with one of these, not all
          of them at once.
        </p>
        <div className="svc-build-grid">
          {buildGroups.map((group) => (
            <div key={group.id} id={group.legacyAnchor} className="svc-build-group">
              <h3 className="svc-build-title">{group.title}</h3>
              <ul className="svc-build-list">
                {group.items.map((item) => (
                  <li key={item}>
                    <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PlatformBand() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="platform" className="svc-band svc-band-tinted section-reveal scroll-mt-[126px]">
      <Container width="wide">
        <Eyebrow className="mb-6">when one workflow isn&apos;t enough</Eyebrow>
        <Heading size={2} as="h2" className="mb-4 max-w-3xl">
          Give the business an operating layer.
        </Heading>
        <p className="mb-5 max-w-2xl text-base leading-relaxed text-white-secondary">
          {commandCenterFraming}
        </p>
        <p className="mb-12 max-w-2xl text-base leading-relaxed text-white-muted">
          {marketingPositioning.commandCenter.description}
        </p>
        <div className="svc-cc-strip">
          {CATEGORY_META.map((category) => (
            <div key={category.id} className="svc-cc-step">
              <span className="svc-cc-glyph" aria-hidden>
                {category.glyph}
              </span>
              <span className="svc-cc-label">{category.label}</span>
              <span className="svc-cc-blurb">{category.blurb}</span>
            </div>
          ))}
        </div>
        <div className="svc-cc-actions">
          <Link href="/command-center" data-cursor="link" className="svc-text-link">
            <span>Explore the Command Center</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link href="/demo/command-center" data-cursor="link" className="svc-text-link">
            <span>Try the live demo</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

function StackBand() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="stack" className="svc-band section-reveal scroll-mt-[126px]">
      <Container width="wide">
        <Eyebrow className="mb-6">built around your tools</Eyebrow>
        <Heading size={2} as="h2" className="mb-4 max-w-3xl">
          We connect the business before we replace anything.
        </Heading>
        <p className="mb-12 max-w-2xl text-base leading-relaxed text-white-muted">
          Most of what a business needs already exists somewhere in its stack. The first job is
          to make those systems pass information to each other.
        </p>
        <div className="svc-stack-grid">
          {integrationGroups.map((group) => (
            <div key={group.title} className="svc-stack-row">
              <h3 className="svc-stack-title">{group.title}</h3>
              <p className="svc-stack-body">{group.body}</p>
            </div>
          ))}
        </div>
        <p className="svc-problem-closing">{integrationClosing}</p>
      </Container>
    </section>
  );
}

function WorkBand() {
  const ref = useReveal<HTMLElement>();
  const featured = featuredServiceWorkSlugs
    .map((slug) => workProjects.find((project) => project.slug === slug))
    .filter((project) => project && project.visibility === "public");
  return (
    <section ref={ref} id="work" className="svc-band svc-band-warm section-reveal scroll-mt-[126px]">
      <Container width="wide">
        <Eyebrow className="mb-6">selected work</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          Real systems, running in real businesses.
        </Heading>
        <div className="svc-work-grid">
          {featured.map((project) => {
            if (!project) return null;
            return (
              <Link
                key={project.slug}
                href={`/work/${project.slug}`}
                data-cursor="link"
                className="svc-work-card"
              >
                <span className="svc-work-category">{project.category}</span>
                <span className="svc-work-name">{project.name}</span>
                <span className="svc-work-headline">{project.cardHeadline}</span>
                <span className="svc-work-desc">{project.cardDescription}</span>
                {project.proof && project.showProofOnCard !== false && (
                  <span className="svc-work-proof">{project.proof}</span>
                )}
                <span className="svc-work-link">
                  <span>Read the case</span>
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
        <div className="mt-10">
          <Link href="/work" data-cursor="link" className="svc-text-link">
            <span>See all work</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

function ShapesBand() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id="shapes" className="svc-band section-reveal scroll-mt-[126px]">
      <Container width="wide">
        <Eyebrow className="mb-6">engagement shapes</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          How the work gets scoped.
        </Heading>
        <div className="svc-shape-grid">
          {engagementShapes.map((shape, index) => (
            <div key={shape.title} className="svc-shape-card">
              <p className="svc-shape-number">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="svc-shape-title">{shape.title}</h3>
              <p className="svc-shape-body">{shape.body}</p>
            </div>
          ))}
        </div>
        <p className="svc-shape-promise">{scopingPromise}</p>
      </Container>
    </section>
  );
}

export function ServicesPageContent() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]!.id);
  const quickNavRef = useRef<HTMLDivElement>(null);

  // Scrollspy tracks the reading line rather than a zero-height observer
  // window. The old observer could miss a section entirely on short mobile
  // viewports, leaving the rail stale while the reader continued down-page.
  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const readingLine = Math.max(144, window.innerHeight * 0.38);
      let nextId = SECTIONS[0]!.id;
      for (const section of SECTIONS) {
        const node = document.getElementById(section.id);
        if (node && node.getBoundingClientRect().top <= readingLine) nextId = section.id;
      }
      setActiveId((current) => (current === nextId ? current : nextId));
    };
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateActiveSection);
    };
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  // Keep the selected item centered inside the rail. Scrolling the rail
  // directly never changes the document's vertical scroll position.
  useEffect(() => {
    const rail = quickNavRef.current;
    const activeLink = rail?.querySelector<HTMLElement>(`[data-section-id="${activeId}"]`);
    if (!rail || !activeLink) return;
    const left = activeLink.offsetLeft - (rail.clientWidth - activeLink.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [activeId]);

  return (
    <>
      <PublicHeroEntrance className="page-offset-roomy relative flex min-h-[88vh] items-center overflow-hidden pb-20">
        <Container width="wide">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="min-w-0">
              <HeroEntranceItem step={1}>
                <Eyebrow className="mb-7">services</Eyebrow>
              </HeroEntranceItem>
              <HeroEntranceItem step={2}>
                <RevealHeading
                  as="h1"
                  className={HERO_HEADING}
                  lead="We find the right AI solution,"
                  accent="then build or run it."
                  entrance="parent"
                />
              </HeroEntranceItem>
              <HeroEntranceItem step={3}>
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                  Strategy, custom systems, managed execution, training, and optimization. The
                  work starts with how your business actually operates.
                </p>
              </HeroEntranceItem>
              <HeroEntranceItem step={4}>
                <div className="mt-9 flex items-center gap-6">
                  <BookCallButton location="services_hero" />
                  <Link
                    href="#build"
                    data-cursor="link"
                    className="text-sm font-medium text-white-secondary underline-offset-4 transition-colors hover:text-gold hover:underline"
                  >
                    See what we build
                  </Link>
                </div>
              </HeroEntranceItem>
            </div>

            <HeroEntranceItem step={3} className="relative min-w-0">
              <ApprovalQueue
                items={SERVICE_QUEUE}
                header="delivery queue"
                actions={["Map", "Build", "Run"]}
                footer={["Completed today", "Running / improving"]}
                initialCount={18}
              />
            </HeroEntranceItem>
          </div>
        </Container>
      </PublicHeroEntrance>

      {/* Sticky section quick-nav. */}
      <nav className="services-subnav sticky z-[80]" aria-label="Services page sections">
        <div ref={quickNavRef} className="services-subnav-rail page-shell">
          {SECTIONS.map((section) => {
            const isActive = activeId === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                data-cursor="link"
                data-section-id={section.id}
                onClick={() => setActiveId(section.id)}
                aria-current={isActive ? "location" : undefined}
                className={`services-subnav-link ${isActive ? "is-active" : ""}`}
              >
                {section.label}
              </a>
            );
          })}
        </div>
      </nav>

      <ProblemBand />
      <ModesBand />
      <BuildBand />
      <PlatformBand />
      <StackBand />
      <WorkBand />
      <ShapesBand />

      {/* process timeline — master language: numbered nodes + connector */}
      <Section width="wide" className="bg-[var(--bg-section-warm)]">
        <Eyebrow className="mb-6">the process</Eyebrow>
        <Heading size={2} as="h2" className="mb-12 max-w-3xl">
          How an engagement works
        </Heading>
        <div className="relative mx-auto max-w-2xl">
          <div
            className="absolute bottom-12 left-[18px] top-3 w-px bg-[color-mix(in_srgb,var(--gold-base)_40%,transparent)]"
            aria-hidden
          />
          {STEPS.map((s, i) => (
            <AnimateOnScroll
              key={s.n}
              delay={i * 0.08}
              as="div"
              className="relative mb-8 flex items-start gap-6 last:mb-0"
            >
              <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border-gold bg-bg-base font-mono text-xs font-semibold text-gold">
                {s.n}
              </span>
              <div className="pt-1">
                <h3 className="font-display text-xl font-semibold text-heading sm:text-2xl">
                  {s.t}
                </h3>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white-muted">{s.d}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </Section>

      {/* closing CTA */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Not sure what you need?
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              That is the point of the first session. Thirty minutes with the engineers who would
              do the work. You leave with a written recommendation. Yours to keep either way.
            </p>
            <BookCallButton location="services_closing" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
