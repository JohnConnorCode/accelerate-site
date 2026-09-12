import "server-only";
import type { AdminAuthorization } from "@/lib/admin/auth";
import { ACCELERATE_TENANT_ID } from "@/lib/tenancy/constants";
import {
  createPlatformServiceRoleClient,
  callWebsiteRpc,
  tenantIdForDatabase,
} from "@/lib/supabase/server";
import { parseWebsiteDocument, type WebsiteDocument } from "./website-document";
import { parseWebsiteCommand, websiteReceiptSchema, type WebsiteReceipt } from "./website-commands";

export interface WebsiteRevision {
  id: string;
  checksum: string;
  createdAt: string;
  document: WebsiteDocument;
}
export interface WebsiteState {
  version: number;
  draft: WebsiteRevision | null;
  publishedRevisionId: string | null;
}

export class WebsiteConflictError extends Error {}

/** An installation-wide surface requires the configured platform owner AND an
 * active admin membership in the bootstrap workspace. A tenant's admin role is
 * deliberately insufficient, including when the URL uses /admin compatibility. */
export function assertWebsiteOwner(auth: AdminAuthorization): void {
  if (
    !auth.isPlatformAdmin ||
    auth.role !== "admin" ||
    auth.tenant.id !== ACCELERATE_TENANT_ID ||
    tenantIdForDatabase(auth.database) !== auth.tenant.id ||
    auth.tenant.status !== "active"
  )
    throw new Error("Only the installation owner can edit this website");
  const modules = auth.tenant.config?.modules as Record<string, unknown> | undefined;
  if (modules?.["site-studio"] !== true)
    throw new Error("Site Studio is disabled for this installation");
}

export async function readWebsite(auth: AdminAuthorization): Promise<WebsiteState> {
  assertWebsiteOwner(auth);
  const database = createPlatformServiceRoleClient("site-studio:owner-read");
  const { data, error } = await database
    .from("site_websites")
    .select("version,draft_revision_id,published_revision_id")
    .eq("tenant_id", auth.tenant.id)
    .maybeSingle();
  if (error)
    throw new Error("Website storage is unavailable. Check installation migrations and retry.");
  if (!data) return { version: 0, draft: null, publishedRevisionId: null };
  let draft: WebsiteRevision | null = null;
  if (data.draft_revision_id) {
    const row = await database
      .from("site_website_revisions")
      .select("id,document,checksum,created_at")
      .eq("tenant_id", auth.tenant.id)
      .eq("id", data.draft_revision_id)
      .single();
    if (row.error) throw new Error("The saved website revision is unavailable");
    draft = {
      id: row.data.id,
      checksum: row.data.checksum,
      createdAt: row.data.created_at,
      document: parseWebsiteDocument(row.data.document),
    };
  }
  return { version: data.version, draft, publishedRevisionId: data.published_revision_id };
}

export async function writeWebsite(
  auth: AdminAuthorization,
  input: unknown,
): Promise<WebsiteReceipt> {
  assertWebsiteOwner(auth);
  const command = parseWebsiteCommand(input);
  const { data, error } = await callWebsiteRpc(
    auth.database,
    {
      p_operation: command.operation,
      p_request_key: command.requestKey,
      p_expected_version: command.expectedVersion,
      p_revision_id: "revisionId" in command ? command.revisionId : null,
      p_document: command.operation === "save" ? command.document : null,
      p_actor_email: auth.user.email ?? auth.user.id,
    },
    auth,
  );
  if (error) {
    if (/stale|request key reused|current saved draft/i.test(error.message))
      throw new WebsiteConflictError(
        "The website changed. Reload it before saving or publishing; your local edits have not been applied.",
      );
    throw new Error(
      "The website change was not completed. Reload the saved state before retrying.",
    );
  }
  return websiteReceiptSchema.parse(data);
}

export async function readWebsiteHistory(auth: AdminAuthorization) {
  assertWebsiteOwner(auth);
  const database = createPlatformServiceRoleClient("site-studio:owner-read");
  const [revisions, receipts] = await Promise.all([
    database
      .from("site_website_revisions")
      .select("id,created_at,checksum")
      .eq("tenant_id", auth.tenant.id)
      .order("created_at", { ascending: false })
      .limit(30),
    database
      .from("site_website_receipts")
      .select("receipt")
      .eq("tenant_id", auth.tenant.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (revisions.error || receipts.error)
    throw new Error("Website history is unavailable. Retry without changing your draft.");
  const published = new Set(
    receipts.data
      .map((row) => websiteReceiptSchema.parse(row.receipt))
      .filter((receipt) => receipt.operation === "publish" || receipt.operation === "rollback")
      .map((receipt) => receipt.publishedRevisionId),
  );
  return revisions.data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    checksum: row.checksum,
    previouslyPublished: published.has(row.id),
  }));
}
