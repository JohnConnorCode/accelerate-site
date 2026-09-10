import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { NonprofitLanding } from "@/components/sections/NonprofitLanding";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "nonprofits")!;

const bundledMetadata = seoMetadata({
  title: "AI for Nonprofits",
  description:
    "We build the systems that thank, steward, and invite supporters back, then we run them alongside your team. Your voice, your data, your approvals.",
  ogTitle: "AI for Nonprofits",
  ogSubtitle: "Every supporter thanked, followed up, and invited back.",
  path: "/industries/nonprofits",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Nonprofits", url: "/industries/nonprofits" },
]);

export default async function NonprofitsPage() {
  const published = await publishedWebsiteOverride("/industries/nonprofits");
  if (published) return published;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical)),
        }}
      />
      <NonprofitLanding />
      <PageEngagementTracker />
    </>
  );
}

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/industries/nonprofits")) ?? bundledMetadata;
}
