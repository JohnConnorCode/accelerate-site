import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function WorkspaceBootstrapPage() {
  const tenantSlug = (await cookies()).get("accelerate-tenant-slug")?.value;
  redirect(tenantSlug ? `/t/${tenantSlug}/admin/today` : "/admin/login?redirect=%2Fworkspace");
}
