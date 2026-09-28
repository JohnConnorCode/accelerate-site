import { WorkspaceMcpConnections } from "@/components/admin/WorkspaceMcpConnections";

export default async function WorkspaceMcpConnect({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; tenantSlug?: string }>;
}) {
  const params = await searchParams;
  return (
    <WorkspaceMcpConnections
      authorizationId={params.authorization_id}
      tenantSlug={params.tenantSlug}
    />
  );
}
