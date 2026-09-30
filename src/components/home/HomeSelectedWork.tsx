import Link from "next/link";
import { featuredWork } from "@/content/work";
import { WorkCard } from "@/components/work/WorkCard";
import { Container, Eyebrow } from "@/components/v2/studio/primitives";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

import { homeWorkContent } from "@/content/site-studio/home";
import type { HomeWorkContent } from "@/lib/site-studio/native-templates";

export function HomeSelectedWork({ content = homeWorkContent }: { content?: HomeWorkContent }) {
  const [featured, ...supporting] = featuredWork;
  return (
    <section
      id="selected-work"
      className="home-selected-work section-y relative overflow-hidden border-t border-[var(--rule)]"
    >
      <AmbientField />
      <Container>
        <Reveal sequence className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div data-home-step="0">
              <Eyebrow className="mb-5">{content.eyebrow}</Eyebrow>
            </div>
            <h2
              data-home-step="1"
              className="max-w-[16ch] text-balance font-display text-[clamp(2.2rem,5vw,5rem)] font-medium leading-[0.92] tracking-[-0.055em] text-[var(--fg)]"
            >
              {content.heading}
            </h2>
            <p
              data-home-step="2"
              className="mt-6 max-w-[62ch] text-pretty leading-7 text-[var(--mid)]"
            >
              {content.body}
            </p>
          </div>
          <div data-home-step="3">
            <Link href={content.ctaHref} className="btn btn-sm">
              {content.ctaLabel}{" "}
              <span aria-hidden="true" className="arw">
                →
              </span>
            </Link>
          </div>
        </Reveal>
        <div className="home-work-layout">
          {featured && <WorkCard project={featured} featured index={0} aspect="cinematic" />}
          <div className="home-work-index" aria-label="More selected projects">
            {supporting.map((project, index) => (
              <Reveal key={project.slug} rv delay={index * 0.11}>
                <Link href={`/work/${project.slug}`} className="home-work-link">
                  <span className="home-work-number" aria-hidden="true">
                    {String(index + 2).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="eyebrow">{project.category}</p>
                    <h3>{project.name}</h3>
                    <p className="home-work-description">{project.cardHeadline}</p>
                  </div>
                  <span className="home-work-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
