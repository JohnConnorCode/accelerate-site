import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "auto-dealers")!;

const bundledMetadata = seoMetadata({
  title: "Auto Dealer & Service Center AI Solutions",
  description: vertical.shortDescription,
  ogTitle: "Auto Dealer & Service Center AI Solutions",
  ogSubtitle: "AI response and follow-up, built and run for your dealership",
  path: "/industries/auto-dealers",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Auto Dealers & Service Centers", url: "/industries/auto-dealers" },
]);

export default async function AutoDealersPage() {
  const published = await publishedWebsiteOverride("/industries/auto-dealers");
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
      <VerticalPage vertical={vertical} />
      <PageEngagementTracker />
    </>
  );
}

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/industries/auto-dealers")) ?? bundledMetadata;
}
