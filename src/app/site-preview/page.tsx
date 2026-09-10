import { WebsitePreviewRuntime } from "@/components/admin/site/WebsitePreviewRuntime";
import { isDemoScenarioId } from "@/lib/admin/demo/scenarios";
export const metadata = {
  title: "Private website preview",
  robots: { index: false, follow: false },
};
export default async function PrivateWebsitePreview({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; scenario?: string }>;
}) {
  const query = await searchParams;
  // A recognized scenario selects fictional session data only. All real preview
  // data is fetched through the owner-only API, even when this route is public.
  return (
    <WebsitePreviewRuntime
      pageId={query.page}
      scenarioId={query.scenario && isDemoScenarioId(query.scenario) ? query.scenario : null}
    />
  );
}
