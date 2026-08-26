import Link from "next/link";
import { featuredWork } from "@/content/work";
import { WorkCard } from "@/components/work/WorkCard";
import { Container, Eyebrow } from "@/components/v2/studio/primitives";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

export function HomeSelectedWork() {
  const layout = [
    { className: "lg:col-span-7", aspect: "cinematic" as const },
    { className: "lg:col-span-5 lg:pt-24", aspect: "editorial" as const },
    { className: "lg:col-span-5", aspect: "editorial" as const },
    { className: "lg:col-span-7 lg:pt-24", aspect: "cinematic" as const },
  ];
  return <section className="section-y relative overflow-hidden border-t border-[var(--rule)]"><AmbientField /><Container><div className="flex flex-wrap items-end justify-between gap-6"><div><Reveal rv><Eyebrow className="mb-5">Selected work</Eyebrow></Reveal><Reveal rv delay={0.06}><h2 className="max-w-[16ch] text-balance font-display text-[clamp(2.2rem,5vw,5rem)] font-medium leading-[0.92] tracking-[-0.055em] text-[var(--fg)]">Systems that had to work in production.</h2></Reveal><Reveal rv delay={0.12}><p className="mt-6 max-w-[62ch] text-pretty leading-7 text-[var(--mid)]">These projects show the operating experience behind Accelerate: finding the constraint, designing the right system, building it, and improving the work around it.</p></Reveal></div><Reveal rv delay={0.16}><Link href="/work" className="btn btn-sm">See all work <span aria-hidden="true" className="arw">→</span></Link></Reveal></div><div className="mt-12 grid gap-x-8 gap-y-10 lg:grid-cols-12 lg:items-start lg:gap-y-20">{featuredWork.map((project, index) => <div key={project.slug} className={layout[index]?.className ?? "lg:col-span-6"}><WorkCard project={project} index={index} aspect={layout[index]?.aspect ?? "wide"} /></div>)}</div></Container></section>;
}
