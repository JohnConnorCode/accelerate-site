import { seoMetadata } from "@/lib/og";
import { Hero } from "@/components/sections/Hero";
import { ProblemSolution } from "@/components/sections/ProblemSolution";
import { ServicesOverview } from "@/components/sections/ServicesOverview";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Industries } from "@/components/sections/Industries";
import { SolutionGeneratorSection } from "@/components/sections/SolutionGeneratorSection";
import { SocialProof } from "@/components/sections/SocialProof";
import { Stats } from "@/components/sections/Stats";
import { FinalCTA } from "@/components/sections/FinalCTA";

export const metadata = seoMetadata({
  title: "Accelerate | AI Solutions for Small Business",
  description:
    "AI-powered websites, automations, and intelligent agents that help small businesses capture more leads, save 10+ hours per week, and grow faster.",
  ogTitle: "AI Solutions for Small Business",
  ogSubtitle: "Capture more leads. Save 10+ hours per week. Grow faster.",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Accelerate",
  description:
    "AI-powered websites, automations, and intelligent agents that help small businesses capture more leads and save time.",
  url: "https://acceleratewith.us",
  email: "hello@acceleratewith.us",
  areaServed: "US",
  serviceType: [
    "AI-Powered Websites",
    "Business Automation",
    "AI Chat Agents",
  ],
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "2500",
    highPrice: "7500",
    priceCurrency: "USD",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <div className="section-divider" />
      <ProblemSolution />
      <div className="section-divider" />
      <ServicesOverview />
      <div className="section-divider" />
      <HowItWorks />
      <div className="section-divider" />
      <Industries />
      <div className="section-divider" />
      <SolutionGeneratorSection />
      <div className="section-divider" />
      <SocialProof />
      <div className="section-divider" />
      <Stats />
      <div className="section-divider" />
      <FinalCTA />
    </>
  );
}
