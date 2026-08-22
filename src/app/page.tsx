import { seoMetadata } from "@/lib/og";
import { generateFaqJsonLd } from "@/lib/seo";
import { homeFaqs } from "@/content/home-faq";
import { Studio } from "@/components/v2/studio/Studio";

export const metadata = seoMetadata({
  title: "Accelerate | AI Strategy & Systems for Small Businesses",
  description:
    "We take intake, follow-up, and scheduling off your team so they can do the work only they can do. Free strategy session.",
  ogTitle: "Your team should be doing the work only they can do",
  ogSubtitle: "AI systems, built and run for operators",
  path: "/",
});

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.acceleratewith.us/#website",
  name: "Accelerate",
  url: "https://www.acceleratewith.us",
  description:
    "Custom business solutions powered by AI, built and run by Accelerate. We absorb the work your people should not be doing, so they can spend the week on jobs, cases, and clients.",
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
    "Custom business solutions powered by AI, built and run by Accelerate. We absorb the work your people should not be doing, so they can spend the week on jobs, cases, and clients.",
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
