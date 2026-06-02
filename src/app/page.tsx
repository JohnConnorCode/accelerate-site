import { seoMetadata } from "@/lib/og";
import { generateFaqJsonLd } from "@/lib/seo";
import { homeFaqs } from "@/content/home-faq";
import { Studio } from "@/components/v2/studio/Studio";

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
    "Custom business solutions powered by AI, built and run by Accelerate. Book more jobs, sign more clients, reclaim hours. We deliver the results and stand behind them.",
  publisher: { "@id": "https://acceleratewith.us/#organization" },
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
    "Custom business solutions powered by AI, built and run by Accelerate. Book more jobs, sign more clients, reclaim hours. We deliver the results and stand behind them.",
  provider: { "@id": "https://acceleratewith.us/#organization" },
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
