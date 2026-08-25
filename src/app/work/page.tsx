import type { Metadata } from "next";
import { BookCallButton, Container, Eyebrow } from "@/components/v2/studio/primitives";
import { WorkIndex } from "@/components/work/WorkIndex";
import { WorkReveal } from "@/components/work/WorkMotion";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { generateBreadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Selected Work",
  description: "Selected work showing how Accelerate identifies business constraints, builds custom AI and automation systems, and improves the work around them.",
  alternates: { canonical: "/work" },
  openGraph: { title: "Selected Work | Accelerate", description: "Strategy, custom systems, and execution built around how the business actually works.", url: "/work", type: "website" },
  twitter: { card: "summary_large_image", title: "Selected Work | Accelerate", description: "Strategy, custom systems, and execution built around how the business actually works." },
};

export default function WorkPage() {
  const breadcrumb = generateBreadcrumbJsonLd([{ name: "Home", url: "/" }, { name: "Work", url: "/work" }]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <section className="page-offset border-b border-[var(--rule)] py-[clamp(4rem,10vw,10rem)]">
        <Container>
          <WorkReveal><Eyebrow className="mb-8">Selected work</Eyebrow></WorkReveal>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(18rem,.55fr)] lg:items-end">
            <div><RevealHeading lead="Built for the work behind the business." as="h1" delay={0.08} stagger={0.05} className="max-w-[11ch] text-balance font-display text-[clamp(3.5rem,9vw,9rem)] font-medium leading-[0.86] tracking-[-0.07em] text-[var(--fg)]" /><WorkReveal delay={0.16}><p className="mt-9 max-w-[64ch] text-pretty text-[1.07rem] leading-8 text-[var(--mid)]">We start with the business, find where time or revenue is being lost, and build the right-sized answer. The work below shows that method across AI operations, custom software, workflow automation, managed execution, growth systems, and product strategy.</p></WorkReveal></div>
            <WorkReveal delay={0.16} className="border-l-2 border-[var(--fg)] pl-6 lg:pb-1"><p className="text-pretty text-[0.96rem] leading-7 text-[var(--mid)]">Selected work by the people behind Accelerate, including current engagements, companies we have built, and projects from earlier roles. Each case identifies the role, the work, and the results we can substantiate.</p><BookCallButton className="mt-7" location="work_index_hero" /></WorkReveal>
          </div>
        </Container>
      </section>
      <WorkIndex />
    </>
  );
}
