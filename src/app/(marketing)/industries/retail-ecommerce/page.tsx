import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "retail-ecommerce")!;

const bundledMetadata = seoMetadata({
  title: "Retail & Ecommerce AI & Business Automation",
  description: vertical.shortDescription,
  ogTitle: "Retail & Ecommerce AI & Business Automation",
  ogSubtitle: "Practical inquiry and delivery workflows",
  path: "/industries/retail-ecommerce",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Retail & Ecommerce", url: "/industries/retail-ecommerce" },
]);

export default async function IndustryPage() {
  const published = await publishedWebsiteOverride("/industries/retail-ecommerce");
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
  return (await publishedWebsiteMetadata("/industries/retail-ecommerce")) ?? bundledMetadata;
}
