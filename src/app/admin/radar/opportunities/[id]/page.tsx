import { RadarWorkspace } from "@/components/admin/RadarWorkspace";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RadarWorkspace opportunityId={id} />;
}
