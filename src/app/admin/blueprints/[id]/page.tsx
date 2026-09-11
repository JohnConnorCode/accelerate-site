import { BlueprintReview } from "@/components/admin/BlueprintReview";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlueprintReview blueprintId={id} />;
}
