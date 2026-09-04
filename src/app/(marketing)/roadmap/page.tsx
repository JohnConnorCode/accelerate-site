import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { RoadmapPageContent } from "@/components/sections/RoadmapPage";

export const metadata = seoMetadata({
  title: "Roadmap",
  description:
    "What's shipped, in progress, planned, and backlog for Accelerate Revenue OS, generated straight from the same manifest the app reads.",
  ogSubtitle: "Shipped, in progress, and planned next",
  path: "/roadmap",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Roadmap", url: "/roadmap" },
]);

export default function RoadmapPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <RoadmapPageContent />
    </>
  );
}
