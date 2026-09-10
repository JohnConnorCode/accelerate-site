import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/constants";
import { parseWebsiteDocument, type WebsiteDocument } from "./website-document";

export type PublicWebsite =
  | { mode: "bootstrap" }
  | { mode: "unpublished" }
  | { mode: "unavailable" }
  | { mode: "published"; revisionId: string; document: WebsiteDocument };

/** A separate public selector never reads draft_revision_id. Saving the first
 * private draft leaves the bundled site intact. Explicitly unpublishing a site
 * that has gone live must not accidentally resurrect the bundled branding. */
export async function selectPublicWebsite(database: SupabaseClient): Promise<PublicWebsite> {
  const tenantId = ACCELERATE_TENANT_ID;
  const tenant = await database.from("tenants").select("status").eq("id", tenantId).maybeSingle();
  if (tenant.error || tenant.data?.status !== "active") return { mode: "unavailable" };
  const current = await database
    .from("site_websites")
    .select("published_revision_id,has_published")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (current.error) return { mode: "unavailable" };
  if (!current.data) return { mode: "bootstrap" };
  if (!current.data.published_revision_id) {
    return { mode: current.data.has_published ? "unpublished" : "bootstrap" };
  }
  const revision = await database
    .from("site_website_revisions")
    .select("id,document")
    .eq("tenant_id", tenantId)
    .eq("id", current.data.published_revision_id)
    .maybeSingle();
  if (revision.error || !revision.data) return { mode: "unavailable" };
  try {
    return {
      mode: "published",
      revisionId: revision.data.id,
      document: parseWebsiteDocument(revision.data.document),
    };
  } catch {
    return { mode: "unavailable" };
  }
}

/** Request-only memoization shares one consistent selection across metadata,
 * chrome and page rendering. It does not cache unpublished data across users. */
export const readPublicWebsite = cache(async (): Promise<PublicWebsite> => {
  // A credential-free fork uses its bundled snapshot. Partial configuration is
  // an error, never permission to read someone else's hosted database.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !key) return { mode: "bootstrap" };
  if (!url || !key) return { mode: "unavailable" };
  // Connected installations select publication at request time. This must stay
  // outside the error boundary: Next uses the call to stop prerendering.
  await connection();
  try {
    return await selectPublicWebsite(
      createPlatformServiceRoleClient("site-studio:public-published-read"),
    );
  } catch {
    return { mode: "unavailable" };
  }
});
