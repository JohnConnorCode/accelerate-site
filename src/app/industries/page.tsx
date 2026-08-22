import Image from "next/image";
import Link from "next/link";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { verticals } from "@/content/verticals";
import { FEATURED_INDUSTRY_SLUGS, industryVisual } from "@/content/industry-visuals";
import { Container, Eyebrow, BookCallButton, CallTerms } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { HERO_HEADING } from "@/lib/type-recipes";

export const metadata = seoMetadata({
  title: "Industries We Serve",
  description:
    "Home services, law firms, professional services, real estate, nonprofits. Same machine, different Tuesday. We build for the trade, then we run it.",
  ogTitle: "Industries We Serve",
  ogSubtitle: "AI systems built for your industry",
  path: "/industries",
});

const FEATURED = FEATURED_INDUSTRY_SLUGS;

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
]);

export default function IndustriesPage() {
  const featured = FEATURED.map((slug) => verticals.find((v) => v.slug === slug)).filter(
    (v): v is NonNullable<typeof v> => Boolean(v)
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className="page-offset-roomy relative">
        <Container className="pb-[clamp(4.5rem,8vw,7rem)] pt-[clamp(2.5rem,5vw,4rem)]">
          <AnimateOnScroll>
            <Eyebrow className="mb-7">industries</Eyebrow>
          </AnimateOnScroll>
          <RevealHeading
            as="h1"
            className={HERO_HEADING}
            lead="Same machine."
            accent="Different Tuesday."
            delay={0.1}
          />
          <AnimateOnScroll delay={0.22}>
            <p className="mt-7 max-w-[46ch] text-[1.08rem] leading-[1.8] text-white-secondary">
              We design around the actual work of the trade, then we run it. Intake, follow-up, and scheduling come off the people who should be doing the job.
            </p>
          </AnimateOnScroll>
        </Container>
      </section>

      <section className="relative pb-[clamp(4.5rem,8vw,7rem)]">
        <Container>
          <div className="grid gap-3 sm:grid-cols-2">
            {featured.map((vertical, i) => {
              const visual = industryVisual(vertical.slug);
              return (
                <AnimateOnScroll key={vertical.id} delay={0.04 * i}>
                  <Link href={`/industries/${vertical.slug}`} className="group relative block min-h-[min(68vw,22rem)] overflow-hidden active:scale-[0.99] sm:min-h-[340px]">
                    {visual && (
                      <Image
                        src={visual.hero.src}
                        alt={visual.hero.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover transition-transform duration-[1.1s] ease-[var(--ease)] group-hover:scale-[1.03]"
                      />
                    )}
                    <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,11,11,.08)_10%,rgba(11,11,11,.78)_100%)]" />
                    <span className="absolute inset-x-0 bottom-0 p-7 text-[var(--paper)]">
                      <span className="block font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/70">
                        {vertical.name}
                      </span>
                      <span className="mt-2 block max-w-[18ch] font-display text-[1.45rem] font-semibold leading-[1.15] tracking-[-0.03em]">
                        {visual?.promise ?? vertical.shortDescription}
                      </span>
                    </span>
                  </Link>
                </AnimateOnScroll>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="ink-panel relative">
        <Container className="py-[clamp(4.5rem,8vw,7rem)]">
          <div className="grid items-end gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <div>
              <Eyebrow className="mb-7 !text-[var(--panel-fg)]">don&apos;t see yours?</Eyebrow>
              <h2 className="h2" style={{ color: "var(--panel-fg)" }}>
                If you have customers,
                <br />
                we can help.
              </h2>
            </div>
            <div>
              <p className="lede max-w-[42ch]" style={{ color: "var(--soft)" }}>
                Thirty minutes. We look at where the hours go. You leave with a plan, yours to keep either way.
              </p>
              <div className="mt-8">
                <BookCallButton variant="inverse" location="industries_index" />
              </div>
              <CallTerms className="mt-8 !border-[color-mix(in_srgb,var(--paper)_18%,transparent)] !text-[var(--soft)]" />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
