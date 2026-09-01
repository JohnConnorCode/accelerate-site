import { Fragment } from "react";
import Link from "next/link";
import { BookCallButton, Container, Eyebrow } from "@/components/v2/studio/primitives";
import type { WorkProject, WorkServiceId, WorkVisualBlock } from "@/content/work";
import { getWorkBySlug } from "@/content/work";
import { services } from "@/content/services";
import { CaseGallery } from "./CaseGallery";
import { WorkCard } from "./WorkCard";
import { WorkReveal } from "./WorkMotion";
import { workAccentClasses, workWorldClasses } from "./workRecipes";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";

const heroWidthClasses: Record<WorkProject["artDirection"]["hero"], string> = {
  wide: "",
  portrait: "mx-auto max-w-[52rem] lg:mr-[5vw]",
  system: "mx-auto max-w-[74rem]",
  window: "mx-auto max-w-[72rem]",
  document: "mx-auto max-w-[68rem]",
};

function VisualBreak({ block, project }: { block: WorkVisualBlock; project: WorkProject }) {
  const tone = block.tone ?? (project.composition === "motion" ? "ink" : "paper");
  const inverted = tone === "ink";
  const toneClass = inverted
    ? "bg-[#0b0b0b] text-[#fbfbfa]"
    : tone === "accent"
      ? "bg-[var(--case-surface)] text-[var(--fg)]"
      : "bg-[var(--bg)] text-[var(--fg)]";

  return (
    <section
      className={`${toneClass} relative py-[clamp(3.5rem,6vw,6.5rem)]`}
      data-visual-layout={block.layout}
      data-visual-tone={tone}
      data-visual-width={block.width ?? "wide"}
    >
      {tone !== "paper" ? (
        <div
          className="absolute inset-x-0 top-0 h-px bg-[var(--case-accent)] opacity-70"
          aria-hidden="true"
        />
      ) : null}
      <Container width={block.width === "contained" ? "narrow" : "wide"}>
        {block.eyebrow || block.title || block.intro ? (
          <WorkReveal className="mb-9 grid gap-5 lg:grid-cols-[minmax(0,.48fr)_minmax(0,1fr)] lg:items-end">
            <div>
              {block.eyebrow ? (
                <Eyebrow className={inverted ? "!text-white/65" : undefined}>
                  {block.eyebrow}
                </Eyebrow>
              ) : null}
            </div>
            <div>
              {block.title ? (
                <h2 className="max-w-[20ch] text-balance font-display text-[clamp(2rem,4.5vw,4.75rem)] font-medium leading-[0.94] tracking-[-0.05em]">
                  {block.title}
                </h2>
              ) : null}
              {block.intro ? (
                <p
                  className={`${inverted ? "text-white/70" : "text-[var(--mid)]"} mt-5 max-w-[65ch] text-pretty text-sm leading-7`}
                >
                  {block.intro}
                </p>
              ) : null}
            </div>
          </WorkReveal>
        ) : null}
        <CaseGallery
          media={[...block.media]}
          layout={block.layout}
          inverted={inverted}
          frame={block.frame ?? project.artDirection.mediaFrame}
          groupLabel={block.eyebrow ?? block.title ?? project.name}
        />
      </Container>
    </section>
  );
}

export function CaseStudy({ project }: { project: WorkProject }) {
  const related = project.related
    .map(getWorkBySlug)
    .filter((item): item is WorkProject => Boolean(item))
    .filter((item) => item.visibility === "public");
  const relevantServices = services.filter((service) =>
    project.serviceIds.includes(service.id as WorkServiceId),
  );
  const visualBlocksBySection = project.visualBlocks.reduce((blocks, block) => {
    const sectionBlocks = blocks.get(block.afterSection) ?? [];
    sectionBlocks.push(block);
    blocks.set(block.afterSection, sectionBlocks);
    return blocks;
  }, new Map<number, WorkVisualBlock[]>());

  return (
    <article
      className={`${workAccentClasses[project.accent]} ${workWorldClasses[project.artDirection.world]} page-offset`}
      data-case-composition={project.composition}
      data-case-world={project.artDirection.world}
      data-case-accent={project.accent}
      data-work-visibility={project.visibility}
    >
      <section className="relative overflow-hidden border-b border-[var(--rule)] pb-[clamp(3rem,8vw,7rem)] pt-[clamp(3rem,7vw,6rem)]">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34vw] opacity-[0.055] lg:block [background-image:linear-gradient(var(--case-accent)_1px,transparent_1px),linear-gradient(90deg,var(--case-accent)_1px,transparent_1px)] [background-size:var(--case-grid)_var(--case-grid)]"
          aria-hidden="true"
        />
        <Container>
          <div className="work-hero-enter work-hero-d1">
            <nav
              aria-label="Breadcrumb"
              className="mb-10 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mid)]"
            >
              <ol className="flex flex-wrap items-center gap-x-2">
                <li>
                  <Link
                    className="inline-flex min-h-10 min-w-10 items-center justify-center"
                    href="/"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    className="inline-flex min-h-10 min-w-10 items-center justify-center"
                    href="/work"
                  >
                    Work
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-[var(--mid)]" aria-current="page">
                  {project.name}
                </li>
              </ol>
            </nav>
          </div>
          {project.visibility === "archived" ? (
            <div className="work-hero-enter work-hero-d2">
              <aside
                className="mb-10 grid gap-3 border-y border-[var(--rule)] py-5 md:grid-cols-[10rem_minmax(0,1fr)]"
                aria-label="Portfolio archive note"
              >
                <Eyebrow>Portfolio archive</Eyebrow>
                <p className="max-w-[68ch] text-pretty text-sm leading-6 text-[var(--mid)]">
                  This prior team project is preserved for direct reference. It is not part of
                  Accelerate&apos;s current selected-work lineup.
                </p>
              </aside>
            </div>
          ) : null}
          <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.58fr)] lg:items-end">
            <div>
              <div className="work-hero-enter work-hero-d2">
                <Eyebrow className="mb-7">{project.category}</Eyebrow>
              </div>
              <RevealHeading
                lead={project.cardHeadline}
                as="h1"
                delay={0.14}
                stagger={0.05}
                className="max-w-[13ch] text-balance font-display text-[clamp(3rem,7vw,7rem)] font-medium leading-[0.88] tracking-[-0.065em] text-[var(--fg)]"
              />
              <p className="work-hero-enter work-hero-d5 mt-8 max-w-[58ch] text-pretty text-[1.05rem] leading-8 text-[var(--mid)]">
                {project.cardDescription}
              </p>
            </div>
            <div>
              <dl className="work-hero-meta grid border-t-2 border-[var(--case-accent)] font-mono text-[10px] uppercase tracking-[0.11em] sm:grid-cols-2 lg:grid-cols-1">
                <div className="border-b border-[var(--rule)] py-4">
                  <dt className="text-[var(--mid)]">Industry</dt>
                  <dd className="mt-2 text-[var(--fg)]">{project.industry}</dd>
                </div>
                <div className="border-b border-[var(--rule)] py-4">
                  <dt className="text-[var(--mid)]">Role</dt>
                  <dd className="mt-2 text-[var(--fg)]">{project.role}</dd>
                </div>
                <div className="border-b border-[var(--rule)] py-4">
                  <dt className="text-[var(--mid)]">Relationship</dt>
                  <dd className="mt-2 text-[var(--fg)]">{project.relationship}</dd>
                </div>
                <div className="border-b border-[var(--rule)] py-4">
                  <dt className="text-[var(--mid)]">Period</dt>
                  <dd className="mt-2 text-[var(--fg)]">{project.timeline}</dd>
                </div>
                {project.proof ? (
                  <div className="border-b border-[var(--rule)] py-4 sm:col-span-2 lg:col-span-1">
                    <dt className="text-[var(--mid)]">
                      {project.proofLabel ?? "Documented proof"}
                    </dt>
                    <dd className="mt-2 tabular-nums text-[var(--fg)]">{project.proof}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-[clamp(2rem,5vw,5rem)]">
        <div
          className={heroWidthClasses[project.artDirection.hero]}
          data-case-hero={project.artDirection.hero}
        >
          <CaseGallery
            media={[project.heroMedia]}
            priority
            frame={project.artDirection.mediaFrame}
            groupLabel={`${project.name} overview`}
          />
        </div>
      </Container>

      <section className="border-t border-[var(--rule)] py-[clamp(3rem,6vw,6rem)]">
        <Container width="narrow">
          {project.sections.map((section, index) => {
            const visualBlocks = visualBlocksBySection.get(index) ?? [];
            const offset =
              project.artDirection.rhythm === "architectural" && index % 2 === 1
                ? "md:pl-[8vw]"
                : project.artDirection.rhythm === "notebook" && index % 2 === 0
                  ? "md:pr-[5vw]"
                  : project.artDirection.rhythm === "cinematic" && index % 2 === 1
                    ? "md:pl-[5vw]"
                    : project.artDirection.rhythm === "stacked" && index % 2 === 0
                      ? "md:pr-[4vw]"
                      : "";
            return (
              <Fragment key={section.title}>
                <WorkReveal
                  className={`${offset} grid gap-6 border-b border-[var(--rule)] py-10 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-[8rem_minmax(0,1fr)] md:py-12`}
                >
                  <Eyebrow>
                    {String(index + 1).padStart(2, "0")} / {section.label}
                  </Eyebrow>
                  <div>
                    <h2 className="max-w-[21ch] text-balance font-display text-[clamp(2rem,4vw,4rem)] font-medium leading-[0.94] tracking-[-0.05em] text-[var(--fg)]">
                      {section.title}
                    </h2>
                    <p className="mt-6 max-w-[64ch] text-pretty text-[1.03rem] leading-8 text-[var(--mid)]">
                      {section.body}
                    </p>
                  </div>
                </WorkReveal>
                {visualBlocks.map((visualBlock, visualIndex) => (
                  <div
                    key={`${visualBlock.title ?? visualBlock.eyebrow ?? index}-${visualIndex}`}
                    className="relative left-1/2 my-[clamp(3rem,5vw,5rem)] w-screen -translate-x-1/2"
                  >
                    <VisualBreak block={visualBlock} project={project} />
                  </div>
                ))}
              </Fragment>
            );
          })}
        </Container>
      </section>

      <section className="bg-[var(--case-surface)] py-[clamp(4rem,8vw,8rem)]">
        <Container width="narrow">
          <WorkReveal role="group">
            <Eyebrow className="mb-6">What this carries forward</Eyebrow>
            <p className="max-w-[42ch] text-balance font-display text-[clamp(2rem,4.5vw,4.3rem)] font-medium leading-[0.96] tracking-[-0.05em] text-[var(--fg)]">
              {project.carryForward}
            </p>
            <div className="mt-10 flex flex-wrap gap-2">
              {project.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="border border-[var(--rule)] bg-[var(--bg)] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--mid)]"
                >
                  {capability}
                </span>
              ))}
            </div>
            {relevantServices.length ? (
              <div className="mt-12 grid gap-5 border-t border-[var(--rule)] pt-8 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start">
                <Eyebrow>Relevant services</Eyebrow>
                <div className="flex flex-wrap gap-3">
                  {relevantServices.map((service) => (
                    <Link
                      key={service.id}
                      href={service.href}
                      className="inline-flex min-h-11 items-center bg-[var(--fg)] py-3 pl-4 pr-3.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bg)] transition-transform duration-150 ease-out active:scale-[0.96]"
                    >
                      {service.name}
                      <span aria-hidden="true" className="ml-2">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </WorkReveal>
        </Container>
      </section>

      <section className="border-t border-[var(--rule)] py-[clamp(4rem,8vw,8rem)]">
        <Container>
          <WorkReveal role="group" className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow className="mb-4">More selected work</Eyebrow>
              <h2 className="max-w-[18ch] text-balance font-display text-[clamp(2rem,4vw,4rem)] font-medium leading-[0.94] tracking-[-0.05em]">
                More systems built around how the business works.
              </h2>
            </div>
            <Link href="/work" className="btn btn-sm min-h-11">
              See all work{" "}
              <span aria-hidden="true" className="arw">
                →
              </span>
            </Link>
          </WorkReveal>
          <div className="mt-12 grid gap-x-8 lg:grid-cols-2">
            {related.map((item) => (
              <WorkCard key={item.slug} project={item} />
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-[var(--fg)] py-[clamp(4rem,8vw,8rem)] text-[var(--bg)]">
        <Container>
          <WorkReveal role="group">
            <Eyebrow className="mb-6 !text-[var(--bg)]">Have a similar constraint?</Eyebrow>
            <h2 className="max-w-[14ch] text-balance font-display text-[clamp(2.8rem,6vw,6rem)] font-medium leading-[0.9] tracking-[-0.06em]">
              Tell us how the work runs today.
            </h2>
            <p className="mt-7 max-w-[62ch] text-pretty text-[1rem] leading-8 text-[color-mix(in_srgb,var(--bg)_72%,transparent)]">
              We will help determine whether the answer is AI, automation, better software, a
              simpler process, or something else.
            </p>
            <BookCallButton
              variant="inverse"
              className="mt-9"
              location={`work_${project.slug}_cta`}
            />
          </WorkReveal>
        </Container>
      </section>
    </article>
  );
}
