import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { ResultsPageContent } from "@/components/sections/ResultsPage";

export const metadata = seoMetadata({
  title: "Case Studies & Results",
  description:
    "See real results from real businesses. Explore how Accelerate has helped small businesses grow revenue, save time, and run smarter with AI-powered systems.",
  ogSubtitle: "Real results from real businesses",
  path: "/results",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Results", url: "/results" },
]);

export default function ResultsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ResultsPageContent />
    </>
  );
}
