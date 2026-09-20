import { AIReadinessAssessment } from "@/components/sections/AIReadinessAssessment";
import { seoMetadata } from "@/lib/og";

export const metadata = seoMetadata({
  title: "AI Readiness Assessment",
  description:
    "Find where AI and automation can help your small business first, with a practical score, optional website audit and 30-day action plan.",
  ogSubtitle: "A practical AI readiness score and action plan",
  path: "/ai-readiness",
});

export default function AIReadinessPage() {
  return <AIReadinessAssessment />;
}
