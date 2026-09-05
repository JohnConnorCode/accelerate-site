import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { RoadmapPageContent } from "@/components/sections/RoadmapPage";
import { getPublicRoadmapCards } from "@/lib/roadmap";

export const metadata = seoMetadata({
  title: "Roadmap",
  description:
    "What's shipped, in progress, planned, and backlog for Accelerate Revenue OS, read live from the same board the team works from.",
  ogSubtitle: "Shipped, in progress, and planned next",
  path: "/roadmap",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Roadmap", url: "/roadmap" },
]);

// Live board, not a static export — see src/lib/roadmap.ts. Five minutes
// keeps it current without a database read on every request.
export const revalidate = 300;

export default async function RoadmapPage() {
  const cards = await getPublicRoadmapCards();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <RoadmapPageContent cards={cards} />
    </>
  );
}
