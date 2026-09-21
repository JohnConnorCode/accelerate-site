import { notFound } from "next/navigation";
import { AIReadinessAssessment } from "@/components/sections/AIReadinessAssessment";
import { loadReport } from "@/lib/ai-readiness-service";
import { seoMetadata } from "@/lib/og";

export const metadata = {
  ...seoMetadata({
    title: "Your AI Readiness Action Plan",
    description: "A practical AI readiness report and 30-day action plan from Accelerate.",
    path: "/ai-readiness/report",
  }),
  robots: { index: false, follow: false },
};

export default async function AIReadinessReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await loadReport(token);
  if (!report) notFound();
  return <AIReadinessAssessment initialReport={report} initialReportToken={token} />;
}
