import { seoMetadata } from "@/lib/og";
import { generateFaqJsonLd } from "@/lib/seo";
import { homeFaqs } from "@/content/home-faq";
import { Studio } from "@/components/v2/studio/Studio";

export const metadata = seoMetadata({
  title: "Accelerate | AI Systems Built and Run for Your Business",
  description:
    "We build and run the system that runs your business: it reads email and meetings, keeps one record per client, and runs the routine work itself. Free 30-minute strategy session.",
  ogTitle: "AI Systems, Built and Run for You",
  ogSubtitle: "Your team keeps the judgment calls. We run the rest.",
  path: "/",
});

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.acceleratewith.us/#website",
  name: "Accelerate",
  url: "https://www.acceleratewith.us",
  description:
    "Custom business solutions powered by AI, built and run by Accelerate. One system that sees everything, remembers everything, and does the routine work itself. You own all of it.",
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
    "Custom business solutions powered by AI, built and run by Accelerate. One system that sees everything, remembers everything, and does the routine work itself. You own all of it.",
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
