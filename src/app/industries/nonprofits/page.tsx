import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { NonprofitLanding } from "@/components/sections/NonprofitLanding";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "nonprofits")!;

export const metadata = seoMetadata({
  title: "AI for Nonprofits",
  description: vertical.shortDescription,
  ogTitle: "AI for Nonprofits",
  ogSubtitle: "Donor stewardship that never slips, built and run for you",
  path: "/industries/nonprofits",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Nonprofits", url: "/industries/nonprofits" },
]);

export default function NonprofitsPage() {
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
