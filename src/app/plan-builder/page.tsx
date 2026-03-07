import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { PlanBuilderShell } from "@/components/plan-builder/PlanBuilderShell";

export const metadata = seoMetadata({
  title: "AI Plan Builder | Accelerate",
  description:
    "Answer a few questions and get a personalized digital growth plan with pricing, timelines, and ROI projections — powered by AI.",
  ogTitle: "Build Your Custom Growth Plan in 5 Minutes",
  ogSubtitle: "AI-powered strategy builder for service businesses.",
  path: "/plan-builder",
});

export default function PlanBuilderRoute() {
  return (
    <>
      <PlanBuilderShell />
      <PageEngagementTracker />
    </>
  );
}
