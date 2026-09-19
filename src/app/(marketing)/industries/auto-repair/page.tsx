import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "auto-repair")!;

const bundledMetadata = seoMetadata({
  title: "Auto Repair AI & Business Automation",
  description: vertical.shortDescription,
  ogTitle: "Auto Repair AI & Business Automation",
  ogSubtitle: "Practical inquiry and delivery workflows",
  path: "/industries/auto-repair",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Auto Repair", url: "/industries/auto-repair" },
]);

export default async function IndustryPage() {
  const published = await publishedWebsiteOverride("/industries/auto-repair");
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
  return (await publishedWebsiteMetadata("/industries/auto-repair")) ?? bundledMetadata;
}
