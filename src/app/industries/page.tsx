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
    "Home services, law firms, professional services, real estate. Same lifecycle, different intake. We build for the trade, then we run it.",
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
              lead="Built for your trade,"
              accent="the way it actually runs."
              delay={0.1}
            />
            <AnimateOnScroll delay={0.3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                Generic software doesn&apos;t cut it. We design, build, and run
                automation around the real workflows and revenue drivers of your
                industry, and we run it alongside you.
              </p>
            </AnimateOnScroll>
          </div>
          <AnimateOnScroll as="div" delay={0.2} className="mx-auto w-full max-w-sm">
            <div className="relative overflow-hidden rounded-3xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] p-7 backdrop-blur-md sm:p-8">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
              <p className="mb-6 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">
                Same lifecycle, every trade
              </p>
              <ol className="relative flex flex-col gap-5">
                <span aria-hidden className="absolute bottom-2 left-[15px] top-2 w-px bg-border-gold" />
                {[
                  { n: "Find", d: "Every inquiry captured: call, text, form, after hours." },
                  { n: "Win", d: "Qualified like you would, followed through until it books." },
                  { n: "Keep", d: "Clients retained, reviews requested, nothing dropped." },
                  { n: "Grow", d: "Every job compounds into the next one." },
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
              If you have customers, we can help.
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              We work with any service-based business. 30 minutes on the phone
              and we&apos;ll tell you exactly where AI can move the needle.
            </p>
            <BookCallButton location="industries_index" />
            <CallTerms />
          </div>
        </div>
      </Section>
    </>
  );
}
