import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isConfiguredAdmin } from "@/lib/admin/access";
import { isSupabasePublicConfigured } from "@/lib/supabase/configuration.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function WorkspaceBootstrapPage() {
  if (
    !isSupabasePublicConfigured(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  )
    redirect("/admin/login?redirect=%2Fworkspace");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?redirect=%2Fworkspace");

  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenants!inner(slug,status)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const activeSlugs = (memberships || []).flatMap((membership) => {
    const linked = membership.tenants as unknown as
      { slug?: string; status?: string } | Array<{ slug?: string; status?: string }>;
    const tenants = Array.isArray(linked) ? linked : [linked];
    return tenants
      .filter((tenant) => tenant?.status === "active" && tenant.slug)
      .map((tenant) => tenant.slug!);
  });
  const rememberedSlug = (await cookies()).get("accelerate-tenant-slug")?.value;
  const tenantSlug =
    (rememberedSlug && activeSlugs.includes(rememberedSlug) ? rememberedSlug : null) ||
    (isConfiguredAdmin(user.email) && activeSlugs.includes("accelerate")
      ? "accelerate"
      : activeSlugs[0]);
  redirect(tenantSlug ? `/t/${tenantSlug}/admin/today` : "/admin/login?error=workspace_access");
}
