import Link from "next/link";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { verticals } from "@/content/verticals";
import { ArrowUpRight, Wrench, Scale, Briefcase, Building2, Factory, Rocket, Stethoscope, ShieldCheck, Car, HeartHandshake } from "lucide-react";
import { Section, Container, Eyebrow, Heading, BookCallButton, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { HERO_HEADING } from "@/lib/type-recipes";

export const metadata = seoMetadata({
  title: "Industries We Serve",
  description:
    "Custom AI strategy, automation, and execution built around the workflows, tools, and goals of your specific business.",
  ogTitle: "Industries We Serve",
  ogSubtitle: "AI systems built for your industry",
  path: "/industries",
});

const iconMap: Record<string, React.ReactNode> = {
  Wrench: <Wrench className="h-6 w-6" strokeWidth={1.75} />,
  Scale: <Scale className="h-6 w-6" strokeWidth={1.75} />,
  Briefcase: <Briefcase className="h-6 w-6" strokeWidth={1.75} />,
  Building2: <Building2 className="h-6 w-6" strokeWidth={1.75} />,
  Factory: <Factory className="h-6 w-6" strokeWidth={1.75} />,
  Rocket: <Rocket className="h-6 w-6" strokeWidth={1.75} />,
  Stethoscope: <Stethoscope className="h-6 w-6" strokeWidth={1.75} />,
  ShieldCheck: <ShieldCheck className="h-6 w-6" strokeWidth={1.75} />,
  Car: <Car className="h-6 w-6" strokeWidth={1.75} />,
  HeartHandshake: <HeartHandshake className="h-6 w-6" strokeWidth={1.75} />,
};

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
]);

export default function IndustriesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* hero — statement left, the universal lifecycle we run for every trade */}
      <section className="page-offset-roomy relative overflow-hidden pb-24">
        <Container width="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="min-w-0">
            <AnimateOnScroll><Eyebrow className="mb-7">industries</Eyebrow></AnimateOnScroll>
            <RevealHeading
              as="h1"
              className={HERO_HEADING}
              lead="Your business is specific."
              accent="The solution should be too."
              delay={0.1}
            />
            <AnimateOnScroll delay={0.3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                We learn the workflows, constraints, tools, and opportunities
                that are specific to your business, then recommend and deliver
                the AI, automation, training, or execution that fits.
              </p>
            </AnimateOnScroll>
          </div>
          <AnimateOnScroll as="div" delay={0.2} className="mx-auto w-full max-w-sm">
            <div className="relative overflow-hidden rounded-3xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-7 backdrop-blur-md sm:p-8">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
              <p className="mb-6 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">
                What we look for in every business
              </p>
              <ol className="relative flex flex-col gap-5">
                <span aria-hidden className="absolute bottom-2 left-[15px] top-2 w-px bg-border-gold" />
                {[
                  { n: "Time", d: "Work that should stop consuming skilled people." },
                  { n: "Revenue", d: "Opportunities the current process leaves behind." },
                  { n: "Tools", d: "Systems worth connecting instead of replacing." },
                  { n: "Fit", d: "The smallest useful solution for this team." },
                ].map((s, i) => (
                  <li key={s.n} className="relative flex items-start gap-4">
                    <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border-gold bg-bg-base font-mono text-[0.6rem] font-bold text-gold">
                      0{i + 1}
                    </span>
                    <div className="pt-0.5">
                      <p className="font-display text-base font-bold text-heading">{s.n}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-white-muted">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </AnimateOnScroll>
        </div>
        </Container>
      </section>

      {/* industry tiles */}
      <Section width="wide" divide>
        <div className="grid gap-5 md:grid-cols-2">
          {verticals.map((vertical) => (
            <Link
              key={vertical.id}
              href={`/industries/${vertical.slug}`}
              data-cursor="link"
              className="group flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] p-7 backdrop-blur-md transition-colors hover:border-border-gold sm:p-8"
            >
              <div className="mb-5 flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] text-gold">
                  {iconMap[vertical.icon]}
                </span>
                <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-heading">
                  {vertical.name}
                </h2>
              </div>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-white-secondary">
                {vertical.shortDescription}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-heading">
                <span className="ink-sweep">Learn more</span>
                <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* closing — master style */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">don&apos;t see yours?</Eyebrow>
            <Heading size={1} as="h2">
              Tell us how your business works.
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              In thirty minutes, we can identify where AI or automation may be
              useful and whether consulting, a focused build, training, managed
              execution, or a larger integrated solution makes sense.
            </p>
            <BookCallButton location="industries_index" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
