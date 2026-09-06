import { RadarWorkspace } from "@/components/admin/RadarWorkspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ opportunityId?: string }>;
}) {
  const { opportunityId } = await searchParams;
  return <RadarWorkspace historyOnly opportunityId={opportunityId} />;
}
