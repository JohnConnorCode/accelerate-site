import { distributionProfile } from "@/lib/distribution/profile";
import { neutralPublicIdentity } from "@/lib/distribution/public-identity";
import { tenant } from "@/config/tenant";
import Link from "next/link";
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
  if (distributionProfile() === "neutral") {
    const identity = neutralPublicIdentity(tenant);
    return {
      title: { absolute: identity.title },
      description: identity.description,
      alternates: { canonical: identity.siteUrl },
    };
  }
  return (await publishedWebsiteMetadata("/")) ?? bundledMetadata;
}

export default async function HomePage() {
  if (distributionProfile() === "neutral")
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
        <p className="text-sm font-medium">Business workspace</p>
        <h1 className="text-4xl font-semibold tracking-tight">{tenant.brand.name}</h1>
        <p className="text-lg">{tenant.brand.tagline}</p>
        <nav aria-label="Workspace entry" className="flex flex-wrap gap-6">
          <Link href="/admin" className="underline underline-offset-4">
            Open your workspace
          </Link>
          <Link href="/demo/command-center" className="underline underline-offset-4">
            Explore fictional demo workspaces
          </Link>
        </nav>
        <p className="text-sm">
          Connect your own services in Setup. Demo changes stay in this browser.
        </p>
      </main>
    );
  const website = await readPublicWebsite();
  if (website.mode !== "bootstrap") return <PublishedWebsitePage path="/" />;
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
