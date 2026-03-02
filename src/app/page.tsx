import { seoMetadata } from "@/lib/og";
import { Hero } from "@/components/sections/Hero";
import { ProblemSolution } from "@/components/sections/ProblemSolution";
import { ServicesOverview } from "@/components/sections/ServicesOverview";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WhyAccelerate } from "@/components/sections/WhyAccelerate";
import { WhoThisIsFor } from "@/components/sections/WhoThisIsFor";
import { Integrations } from "@/components/sections/Integrations";
import { SocialProof } from "@/components/sections/SocialProof";
import { LeadMagnet } from "@/components/sections/LeadMagnet";
import { HomeFAQ } from "@/components/sections/HomeFAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";

export const metadata = seoMetadata({
  title: "Accelerate | AI Strategy & Systems for Small Businesses",
  description:
    "We help small businesses figure out where AI fits, then build and manage the systems that make it happen. Free discovery call.",
  ogTitle: "AI Strategy & Systems for Small Businesses",
  ogSubtitle: "Operate like you're ten times your size.",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Accelerate",
  description:
    "We help small businesses figure out where AI fits, then build and manage the systems that make it happen.",
  url: "https://acceleratewith.us",
  email: "john@acceleratewith.us",
  areaServed: "US",
  serviceType: [
    "AI Strategy & Roadmap",
    "Workflow Automation",
    "Sales & Marketing Automation",
    "Customer Engagement",
    "Content Creation",
    "Data & Reporting",
  ],
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "1500",
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
      <WhyAccelerate />
      <WhoThisIsFor />
      <Integrations />
      <SocialProof />
      <LeadMagnet />
      <HomeFAQ />
      <FinalCTA />
    </>
  );
}
