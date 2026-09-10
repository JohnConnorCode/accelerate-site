import { WebsitePreviewFrame } from "@/components/admin/site/WebsitePreviewFrame";
export const metadata = {
  title: "Private website preview",
  robots: { index: false, follow: false },
};
export default async function WebsitePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <WebsitePreviewFrame pageId={page} />;
}
