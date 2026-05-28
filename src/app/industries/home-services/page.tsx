import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "home-services")!;

export const metadata = seoMetadata({
  title: "Home Services AI Solutions",
  description: vertical.shortDescription,
  ogTitle: "Home Services AI Solutions",
  ogSubtitle: "AI-powered growth tools for home service businesses",
  path: "/industries/home-services",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Home Services", url: "/industries/home-services" },
]);

export default function HomeServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical, "farrell-roofing")),
        }}
      />
      <VerticalPage vertical={vertical} />
      <PageEngagementTracker />
    </>
  );
}
