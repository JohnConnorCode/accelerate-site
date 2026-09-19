import { SiteEditorConnections } from "@/components/admin/site/SiteEditorConnections";
export default async function SiteEditorConnect({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  return <SiteEditorConnections authorizationId={(await searchParams).authorization_id} />;
}
