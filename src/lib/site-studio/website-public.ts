import { isSetupPlaceholder } from "@/lib/supabase/configuration.mjs";
import "server-only";
import { cache } from "react";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/constants";
import { parseWebsiteDocument, type WebsiteDocument } from "./website-document";

export type PublicWebsite =
  | { mode: "bootstrap" }
  | { mode: "unpublished" }
  | { mode: "unavailable" }
  | { mode: "published"; revisionId: string; document: WebsiteDocument };

/** The published site changes on publish, rollback and unpublish only, so the
 * public read is cached under one tag and invalidated from that write boundary.
 * The revalidation window is the fallback for a missed invalidation. */
export const PUBLIC_WEBSITE_TAG = "site-studio:public-website";
export const PUBLIC_WEBSITE_REVALIDATE_SECONDS = 60;

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

/** The published site changes only on publish, rollback and unpublish, so one
 * cached read serves every marketing route and prerendered page. An unavailable
 * installation throws instead of returning, so a transient database error is
 * never stored as the cached truth for the whole window. */
const loadPublicWebsite = unstable_cache(
  async (): Promise<PublicWebsite> => {
    const website = await selectPublicWebsite(
      createPlatformServiceRoleClient("site-studio:public-published-read"),
    );
    if (website.mode === "unavailable")
      throw new Error("The published website is temporarily unavailable.");
    return website;
  },
  ["site-studio:published-website"],
  { tags: [PUBLIC_WEBSITE_TAG], revalidate: PUBLIC_WEBSITE_REVALIDATE_SECONDS },
);

/** Request-only memoization shares one consistent selection across metadata,
 * chrome and page rendering. It does not cache unpublished data across users. */
export const readPublicWebsite = cache(async (): Promise<PublicWebsite> => {
  // A credential-free fork uses its bundled snapshot. Partial configuration is
  // an error, never permission to read someone else's hosted database.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isSetupPlaceholder(url) && isSetupPlaceholder(key)) return { mode: "bootstrap" };
  if (isSetupPlaceholder(url) || isSetupPlaceholder(key)) return { mode: "unavailable" };
  try {
    return await loadPublicWebsite();
  } catch {
    return { mode: "unavailable" };
  }
});

/** Called from the website write boundary after a command that can change the
 * public output, so the next visit sees the change instead of waiting out the
 * fallback window. */
export function revalidatePublishedWebsite(): void {
  revalidateTag(PUBLIC_WEBSITE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
