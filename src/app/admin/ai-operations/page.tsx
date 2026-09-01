import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AiOperationsCompatibilityPage() {
  const requestHeaders = await headers();
  const scenarioId = requestHeaders.get("x-accelerate-demo-scenario");
  redirect(scenarioId ? `/demo/command-center/${scenarioId}/ai?view=runs` : "/admin/ai?view=runs");
}
