"use client";
import { AdminDemoBoundary } from "@/components/admin/AdminDemoBoundary";
import type { DemoScenarioId } from "@/lib/admin/demo/scenarios";
import { WebsitePreview } from "./WebsitePreview";
export function WebsitePreviewRuntime({
  pageId,
  scenarioId,
}: {
  pageId?: string;
  scenarioId: DemoScenarioId | null;
}) {
  return (
    <AdminDemoBoundary scenarioId={scenarioId}>
      <WebsitePreview pageId={pageId} />
    </AdminDemoBoundary>
  );
}
