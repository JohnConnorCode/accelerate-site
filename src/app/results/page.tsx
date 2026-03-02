import { seoMetadata } from "@/lib/og";
import { ResultsPageContent } from "@/components/sections/ResultsPage";

export const metadata = seoMetadata({
  title: "Case Studies & Results",
  description:
    "See real results from real businesses. Explore how Accelerate has helped small businesses grow revenue, save time, and run smarter with AI-powered systems.",
  ogSubtitle: "Real results from real businesses",
});

export default function ResultsPage() {
  return <ResultsPageContent />;
}
