import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "law-firms")!;

export const metadata = seoMetadata({
  title: "Law Firm AI Solutions",
  description: vertical.shortDescription,
  ogTitle: "Law Firm AI Solutions",
  ogSubtitle: "AI-powered growth tools for law firms",
  path: "/industries/law-firms",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Law Firms", url: "/industries/law-firms" },
]);

export default function LawFirmsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical, "sparkblox")),
        }}
      />
      <VerticalPage vertical={vertical} />
      <PageEngagementTracker />
    </>
  );
}
