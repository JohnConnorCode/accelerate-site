import { distributionProfile } from "@/lib/distribution/profile";
import { neutralPublicIdentity } from "@/lib/distribution/public-identity";
import { tenant } from "@/config/tenant";
import { createNeutralWebsite } from "@/lib/site-studio/neutral-website";
import { WebsitePageContent } from "@/lib/site-studio/website-renderer";
import { renderNativeWebsiteSection } from "@/lib/site-studio/native-renderer";
import { readPublicWebsite } from "@/lib/site-studio/website-public";
import { PublishedWebsitePage, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { seoMetadata } from "@/lib/og";
import { generateFaqJsonLd } from "@/lib/seo";
import { homeFaqs } from "@/content/home-faq";
import { Studio } from "@/components/v2/studio/Studio";
import { marketingPositioning } from "@/content/marketing-positioning";

const bundledMetadata = seoMetadata({
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
  description: marketingPositioning.coreOffer,
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
  description: marketingPositioning.coreOffer,
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

export async function generateMetadata() {
  const published = await publishedWebsiteMetadata("/");
  if (published) return published;
  if (distributionProfile() === "neutral") {
    const identity = neutralPublicIdentity(tenant);
    return {
      title: { absolute: identity.title },
      description: identity.description,
      alternates: { canonical: identity.siteUrl },
    };
  }
  return bundledMetadata;
}

export default async function HomePage() {
  const website = await readPublicWebsite();
  if (website.mode !== "bootstrap") return <PublishedWebsitePage path="/" />;
  if (distributionProfile() === "neutral") {
    const starter = createNeutralWebsite();
    return (
      <WebsitePageContent
        page={starter.pages[0]!}
        assets={starter.assets}
        renderNative={renderNativeWebsiteSection}
      />
    );
  }

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
      <Studio />
    </>
  );
}
