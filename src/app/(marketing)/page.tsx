import { seoMetadata } from "@/lib/og";
import { generateFaqJsonLd } from "@/lib/seo";
import { homeFaqs } from "@/content/home-faq";
import { Studio } from "@/components/v2/studio/Studio";
import { marketingPositioning } from "@/content/marketing-positioning";

export const metadata = seoMetadata({
  title: "Accelerate | Custom AI Strategy, Solutions & Execution",
  description: marketingPositioning.shortOffer,
  ogTitle: "The Right AI Solution for Your Business",
  ogSubtitle: "Strategy, custom builds, execution, training, and ongoing improvement",
  path: "/",
});

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.acceleratewith.us/#website",
  name: "Accelerate",
  url: "https://www.acceleratewith.us",
  description:
    marketingPositioning.coreOffer,
  publisher: { "@id": "https://www.acceleratewith.us/#organization" },
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.acceleratewith.us/learn?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const faqJsonLd = generateFaqJsonLd(homeFaqs);

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://www.acceleratewith.us/#service",
  name: "AI Strategy & Systems for Small Business",
  description:
    marketingPositioning.coreOffer,
  provider: { "@id": "https://www.acceleratewith.us/#organization" },
  serviceType: [
    "AI Strategy & Roadmap",
    "Workflow Automation",
    "Sales & Marketing Automation",
    "Customer Engagement",
    "Content Creation",
    "Data & Reporting",
  ],
  areaServed: { "@type": "Country", name: "United States" },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Studio />
    </>
  );
}
