import Link from "next/link";
import type { WorkProject } from "@/content/work";
import { CaseMedia } from "./CaseMedia";
import { WorkReveal } from "./WorkMotion";
import { workAccentClasses } from "./workRecipes";

type CardAspect = "wide" | "editorial" | "portrait" | "cinematic" | "square";

export function WorkVisual({ project, priority = false, aspect = "wide" }: { project: WorkProject; priority?: boolean; aspect?: CardAspect }) {
  return (
    <div className="relative overflow-hidden" data-work-visual={project.slug}>
      <CaseMedia media={project.cardMedia} priority={priority} compact aspect={aspect} frame={project.artDirection.mediaFrame} />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 bg-[var(--fg)] px-3 py-2 text-[var(--bg)] shadow-[0_4px_16px_rgba(0,0,0,.18)] sm:left-4 sm:top-4">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--case-accent)]" aria-hidden="true" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em]">{project.name}</span>
      </div>
    </div>
  );
}

export function WorkCard({ project, featured = false, priority = false, index, aspect = "wide" }: { project: WorkProject; featured?: boolean; priority?: boolean; index?: number; aspect?: CardAspect }) {
  return (
    <WorkReveal className={`${workAccentClasses[project.accent]} h-full`} delay={typeof index === "number" ? (index % 2) * 0.08 : 0}>
      <article className="group h-full border-t border-[var(--rule)] pt-5" data-work-card={project.slug} data-work-accent={project.accent}>
        <Link href={`/work/${project.slug}`} className="block min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--case-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]" aria-label={`View ${project.name} case study`}>
          <div className="origin-center transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 group-active:scale-[0.96] motion-reduce:transition-none">
            <WorkVisual project={project} priority={priority} aspect={aspect} />
          </div>
          <div className="py-6">
            <div className="flex items-start justify-between gap-5">
              <p className="eyebrow mb-4">{project.category}</p>
              {typeof index === "number" ? <span className="font-mono text-[10px] tabular-nums tracking-[0.14em] text-[var(--mid)]">{String(index + 1).padStart(2, "0")}</span> : null}
            </div>
            <h3 className={`${featured ? "text-[clamp(1.8rem,3.25vw,3.35rem)]" : "text-[clamp(1.5rem,2.1vw,2.35rem)]"} max-w-[19ch] text-balance font-display font-medium leading-[0.98] tracking-[-0.04em] text-[var(--fg)]`}>{project.cardHeadline}</h3>
            <p className="mt-4 max-w-[58ch] text-pretty text-[0.97rem] leading-7 text-[var(--mid)]">{project.cardDescription}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.12em]">
              {project.proof && project.showProofOnCard !== false ? <span className="border-l-2 border-[var(--case-accent)] pl-4 tabular-nums text-[var(--fg)]">{project.proofLabel ? <span className="mr-2 text-[var(--mid)]">{project.proofLabel} ·</span> : null}{project.proof}</span> : null}
              <span className="inline-flex min-h-11 items-center gap-2 text-[var(--fg)]">View case study <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">→</span></span>
            </div>
          </div>
        </Link>
      </article>
    </WorkReveal>
  );
}
