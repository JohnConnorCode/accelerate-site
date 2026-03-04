import { seoMetadata } from "@/lib/og";
import { generateFaqJsonLd } from "@/lib/seo";
import { homeFaqs } from "@/content/home-faq";
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
import { SectionDivider } from "@/components/ui/SectionDivider";

export const metadata = seoMetadata({
  title: "Accelerate | AI Strategy & Systems for Small Businesses",
  description:
    "We help small businesses figure out where AI fits, then build and manage the systems that make it happen. Free discovery call.",
  ogTitle: "AI Strategy & Systems for Small Businesses",
  ogSubtitle: "Operate like you're ten times your size.",
  path: "/",
});

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://acceleratewith.us/#website",
  name: "Accelerate",
  url: "https://acceleratewith.us",
  description:
    "AI strategy and systems for small businesses. We figure out where AI fits, then build and manage the systems that make it happen.",
  publisher: {
    "@id": "https://acceleratewith.us/#organization",
  },
  potentialAction: {
    "@type": "SearchAction",
    target: "https://acceleratewith.us/learn?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const faqJsonLd = generateFaqJsonLd(homeFaqs);

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://acceleratewith.us/#service",
  name: "AI Strategy & Systems for Small Business",
  description:
    "We help small businesses figure out where AI fits, then build and manage the systems that make it happen.",
  provider: {
    "@id": "https://acceleratewith.us/#organization",
  },
  serviceType: [
    "AI Strategy & Roadmap",
    "Workflow Automation",
    "Sales & Marketing Automation",
    "Customer Engagement",
    "Content Creation",
    "Data & Reporting",
  ],
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Hero />
      <ServicesOverview />
      <SectionDivider variant="fade" />
      <WhoThisIsFor />
      <SectionDivider variant="glow" />
      <ProblemSolution />
      <SectionDivider variant="glow" />
      <SocialProof />
      <SectionDivider variant="glow" />
      <HowItWorks />
      <SectionDivider variant="glow" />
      <WhyAccelerate />
      <SectionDivider variant="glow" />
      <Integrations />
      <SectionDivider variant="glow" />
      <LeadMagnet />
      <SectionDivider variant="glow" />
      <HomeFAQ />
      <SectionDivider variant="fade" />
      <FinalCTA />
    </>
  );
}
