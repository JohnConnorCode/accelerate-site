import Link from "next/link";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { ArrowRight, Globe, Calculator } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

export const metadata = seoMetadata({
  title: "Free AI Tools for Small Business",
  description:
    "Free tools to audit your website and calculate your AI automation ROI. Get actionable insights in minutes — no signup required.",
  ogTitle: "Free AI Tools",
  ogSubtitle: "Website grader, ROI calculator, and more",
  path: "/tools",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Tools", url: "/tools" },
]);

const tools = [
  {
    name: "Website Grader",
    description:
      "Get an instant analysis of your website's performance, SEO, mobile-friendliness, security, and accessibility. See exactly where your site stands and what to fix first.",
    href: "/tools/website-grader",
    icon: <Globe className="w-6 h-6" />,
    cta: "Grade Your Website",
  },
  {
    name: "ROI Calculator",
    description:
      "Enter your business numbers and see how much revenue AI-powered automation could add. Get projected time savings, revenue gains, and payback period instantly.",
    href: "/tools/roi-calculator",
    icon: <Calculator className="w-6 h-6" />,
    cta: "Calculate Your ROI",
  },
];

export default function ToolsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className="relative pt-28 pb-20 bg-[var(--bg-section-warm)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.05)] to-transparent" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <SectionHeader
              label="Free Tools"
              heading={
                <>
                  AI-Powered Tools to{" "}
                  <span className="text-gold-gradient">Grow Your Business</span>
                </>
              }
              description="No signup required. Get actionable insights about your website and your potential AI automation ROI in minutes."
              className="mb-16"
            />
          </ScrollReveal>

          <div className="grid gap-6 md:grid-cols-2">
            {tools.map((tool, i) => (
              <ScrollReveal key={tool.href} animation="fade-up" delay={0.15 + i * 0.1}>
                <Link href={tool.href} className="block h-full">
                  <GlassCard hover="lift" padding="lg" className="h-full flex flex-col">
                    <div className="w-12 h-12 rounded-xl bg-[rgba(var(--accent-rgb),0.1)] border border-[rgba(var(--accent-rgb),0.2)] flex items-center justify-center text-[var(--gold-base)] mb-4">
                      {tool.icon}
                    </div>
                    <h2 className="font-display text-xl font-bold text-[var(--heading-color)] mb-3">
                      {tool.name}
                    </h2>
                    <p className="text-[var(--white-secondary)] text-sm leading-relaxed mb-6 flex-1">
                      {tool.description}
                    </p>
                    <Button variant="primary" size="sm" className="w-full">
                      {tool.cta}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </GlassCard>
                </Link>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal animation="fade-up" delay={0.3}>
            <div className="mt-16 text-center">
              <p className="text-[var(--white-muted)] mb-6">
                Want a custom AI growth plan for your business?
              </p>
              <Link href="/plan-builder">
                <Button variant="secondary" size="lg">
                  Build Your Growth Plan
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
