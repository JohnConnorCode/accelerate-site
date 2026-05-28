import Link from "next/link";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { verticals } from "@/content/verticals";
import { ArrowRight, Wrench, Scale, Briefcase, Building2 } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { BokehField } from "@/components/ui/BokehField";

export const metadata = seoMetadata({
  title: "Industries We Serve",
  description:
    "AI strategy and automation systems built for home services, law firms, professional services, and real estate. Industry-specific solutions, not generic software.",
  ogTitle: "Industries We Serve",
  ogSubtitle: "AI systems built for your industry",
  path: "/industries",
});

const iconMap: Record<string, React.ReactNode> = {
  Wrench: <Wrench className="w-6 h-6" />,
  Scale: <Scale className="w-6 h-6" />,
  Briefcase: <Briefcase className="w-6 h-6" />,
  Building2: <Building2 className="w-6 h-6" />,
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

      <section className="relative pt-24 pb-16 bg-[var(--bg-section-warm)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.05)] to-transparent" />
          <BokehField />
        </div>

        <div className="relative z-10 page-shell">
          <ScrollReveal animation="fade-up">
            <SectionHeader
              label="Industries"
              heading={
                <>
                  AI Systems Built for{" "}
                  <span className="text-gold-gradient">Your Industry</span>
                </>
              }
              description="Generic software doesn't cut it. We build AI-powered automation tailored to the specific workflows, challenges, and revenue drivers of your industry."
              className="mb-16"
            />
          </ScrollReveal>

          <div className="grid gap-6 md:grid-cols-2">
            {verticals.map((vertical, i) => (
              <ScrollReveal key={vertical.id} animation="fade-up" delay={0.15 + i * 0.1}>
                <Link href={`/industries/${vertical.slug}`} className="block h-full">
                  <GlassCard hover="lift" padding="lg" className="h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center text-gold">
                        {iconMap[vertical.icon]}
                      </div>
                      <h2 className="font-display text-xl font-bold text-heading">
                        {vertical.name}
                      </h2>
                    </div>
                    <p className="text-white-secondary text-sm leading-relaxed mb-6 flex-1">
                      {vertical.shortDescription}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium text-gold">
                      Learn more <ArrowRight className="w-4 h-4" />
                    </div>
                  </GlassCard>
                </Link>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal animation="fade-up" delay={0.3}>
            <div className="mt-16 text-center">
              <p className="text-white-muted mb-6">
                Don&apos;t see your industry? We work with any service-based business.
              </p>
              <Link href="/contact">
                <Button variant="primary" size="lg">
                  Talk to Us About Your Business
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
