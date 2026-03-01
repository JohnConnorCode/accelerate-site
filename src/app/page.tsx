import { seoMetadata } from "@/lib/og";
import { Hero } from "@/components/sections/Hero";
import { ProblemSolution } from "@/components/sections/ProblemSolution";
import { ServicesOverview } from "@/components/sections/ServicesOverview";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Industries } from "@/components/sections/Industries";
import { PlanBuilderCTA } from "@/components/sections/PlanBuilderCTA";
import { SocialProof } from "@/components/sections/SocialProof";
import { Stats } from "@/components/sections/Stats";
import { FinalCTA } from "@/components/sections/FinalCTA";

export const metadata = seoMetadata({
  title: "Accelerate | AI Solutions for Small Business",
  description:
    "We implement AI-powered websites, automations, and intelligent agents for service businesses. Close more clients, save 10+ hours per week, and grow faster with one accountable partner.",
  ogTitle: "AI Solutions for Small Business",
  ogSubtitle: "Close more clients. Save 10+ hours per week. Grow faster.",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Accelerate",
  description:
    "We implement AI-powered websites, automations, and intelligent agents for service businesses — and operate the systems with you to drive real results.",
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
      <ProblemSolution />
      <ServicesOverview />
      <HowItWorks />
      <Industries />
      <PlanBuilderCTA />
      <SocialProof />
      <Stats />
      <FinalCTA />
    </>
  );
}
