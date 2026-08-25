import Link from "next/link";
import { featuredWork } from "@/content/work";
import { WorkCard } from "@/components/work/WorkCard";
import { Container, Eyebrow } from "@/components/v2/studio/primitives";

export function HomeSelectedWork() {
  return <section className="section-y border-t border-[var(--rule)]"><Container><div className="flex flex-wrap items-end justify-between gap-6"><div><Eyebrow className="mb-5">Selected work</Eyebrow><h2 className="max-w-[16ch] text-balance font-display text-[clamp(2.2rem,5vw,5rem)] font-medium leading-[0.92] tracking-[-0.055em] text-[var(--fg)]">Systems that had to work in production.</h2><p className="mt-6 max-w-[62ch] text-pretty leading-7 text-[var(--mid)]">These projects show the operating experience behind Accelerate: finding the constraint, designing the right system, building it, and improving the work around it.</p></div><Link href="/work" className="btn btn-sm">See all work <span aria-hidden="true" className="arw">→</span></Link></div><div className="mt-12 grid gap-x-8 lg:grid-cols-2">{featuredWork.map((project, index) => <WorkCard key={project.slug} project={project} index={index} />)}</div></Container></section>;
}
